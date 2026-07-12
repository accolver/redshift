#!/bin/sh
set -eu

EXPECTED_TAG=${1:?usage: redshift-release-test <vX.Y.Z>}
EXPECTED_VERSION=${EXPECTED_TAG#v}
ROOT=$(mktemp -d)
RELAY_PID=

cleanup() {
  if [ -n "$RELAY_PID" ]; then
    kill "$RELAY_PID" 2>/dev/null || true
    wait "$RELAY_PID" 2>/dev/null || true
  fi
  rm -rf "$ROOT"
}
trap cleanup EXIT HUP INT TERM

export HOME="$ROOT/home"
export REDSHIFT_VERSION="$EXPECTED_TAG"
export REDSHIFT_INSTALL_DIR="$HOME/.local/bin"
export PATH="$REDSHIFT_INSTALL_DIR:$PATH"
mkdir -p "$HOME" "$REDSHIFT_INSTALL_DIR" "$ROOT/work" "$ROOT/config"

printf 'Installing public release %s on %s/%s\n' "$EXPECTED_TAG" "$(uname -s)" "$(uname -m)"
curl -fsSL https://redshiftapp.com/install | sh

VERSION_OUTPUT=$(redshift --version)
printf '%s\n' "$VERSION_OUTPUT"
printf '%s' "$VERSION_OUTPUT" | grep -F "$EXPECTED_VERSION" >/dev/null
redshift --help >/dev/null
if redshift --definitely-unknown >/dev/null 2>&1; then
  echo 'unknown command unexpectedly succeeded' >&2
  exit 1
fi

PORT=3347
RELAY="ws://127.0.0.1:$PORT"
nak serve --hostname 127.0.0.1 --port "$PORT" >"$ROOT/nak.log" 2>&1 &
RELAY_PID=$!
ready=false
for _ in $(seq 1 50); do
  if command -v timeout >/dev/null 2>&1; then
    READY_COMMAND="timeout 2 nak count -k 1 $RELAY"
  elif command -v gtimeout >/dev/null 2>&1; then
    READY_COMMAND="gtimeout 2 nak count -k 1 $RELAY"
  else
    READY_COMMAND="nak count -k 1 $RELAY"
  fi
  if sh -c "$READY_COMMAND" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.1
done
if [ "$ready" != true ]; then
  cat "$ROOT/nak.log" >&2
  echo 'local release-test relay did not start' >&2
  exit 1
fi

HEX_SECRET=$(nak key generate)
export REDSHIFT_NSEC
REDSHIFT_NSEC=$(nak encode nsec "$HEX_SECRET")
GLOBAL_ARGS="--config-dir $ROOT/config"
cd "$ROOT/work"

# shellcheck disable=SC2086
redshift $GLOBAL_ARGS configure set "relays=$RELAY"
# shellcheck disable=SC2086
redshift $GLOBAL_ARGS setup --project release-container --config production --no-interactive
# shellcheck disable=SC2086
redshift $GLOBAL_ARGS secrets set API_KEY release-container-secret --project release-container --config production
# shellcheck disable=SC2086
redshift $GLOBAL_ARGS secrets --project release-container --config production | grep API_KEY >/dev/null
RAW=$(redshift $GLOBAL_ARGS secrets get API_KEY --raw --project release-container --config production)
[ "$RAW" = release-container-secret ]

INITIAL_EVENT_ID=$(redshift $GLOBAL_ARGS history list --project release-container --config production | awk 'NR == 1 { print $2 }')
printf '%s' "$INITIAL_EVENT_ID" | grep -E '^[0-9a-f]{64}$' >/dev/null
if redshift $GLOBAL_ARGS history restore "$INITIAL_EVENT_ID" --project release-container --config production >/dev/null 2>&1; then
  echo 'history restore without explicit consent unexpectedly succeeded' >&2
  exit 1
fi
AFTER_UNCONFIRMED_ID=$(redshift $GLOBAL_ARGS history list --project release-container --config production | awk 'NR == 1 { print $2 }')
[ "$AFTER_UNCONFIRMED_ID" = "$INITIAL_EVENT_ID" ]
# shellcheck disable=SC2086
redshift $GLOBAL_ARGS secrets set API_KEY release-container-updated --project release-container --config production
CURRENT_EVENT_ID=$(redshift $GLOBAL_ARGS history list --project release-container --config production | awk 'NR == 1 { print $2 }')
HISTORY_DIFF=$(redshift $GLOBAL_ARGS history compare "$INITIAL_EVENT_ID" "$CURRENT_EVENT_ID" --project release-container --config production)
printf '%s' "$HISTORY_DIFF" | grep -F 'changed: API_KEY' >/dev/null
if printf '%s' "$HISTORY_DIFF" | grep -F 'release-container-secret' >/dev/null; then
  echo 'plaintext secret appeared in history comparison' >&2
  exit 1
fi
redshift $GLOBAL_ARGS history restore "$INITIAL_EVENT_ID" --project release-container --config production --yes
RESTORED_HISTORY=$(redshift $GLOBAL_ARGS secrets get API_KEY --raw --project release-container --config production)
[ "$RESTORED_HISTORY" = release-container-secret ]

cat >"$ROOT/inspect.sh" <<'SCRIPT'
#!/bin/sh
printf '%s|%s' "$API_KEY" "${REDSHIFT_NSEC-unset}"
SCRIPT
chmod 0755 "$ROOT/inspect.sh"
RUN_OUTPUT=$(redshift $GLOBAL_ARGS run --project release-container --config production -- "$ROOT/inspect.sh")
[ "$RUN_OUTPUT" = 'release-container-secret|unset' ]

BACKUP_PASSPHRASE='release backup passphrase 2026'
BACKUP_PATH="$ROOT/release.redshift"
printf '%s\n%s\n' "$BACKUP_PASSPHRASE" "$BACKUP_PASSPHRASE" \
  | redshift $GLOBAL_ARGS backup create "$BACKUP_PATH" --passphrase-stdin
if stat -c '%a' "$BACKUP_PATH" >/dev/null 2>&1; then
  BACKUP_MODE=$(stat -c '%a' "$BACKUP_PATH")
else
  BACKUP_MODE=$(stat -f '%Lp' "$BACKUP_PATH")
fi
[ "$BACKUP_MODE" = 600 ]
if grep -a -F 'release-container-secret' "$BACKUP_PATH" >/dev/null; then
  echo 'plaintext secret appeared in encrypted backup' >&2
  exit 1
fi

TARGET_HEX_SECRET=$(nak key generate)
TARGET_NSEC=$(nak encode nsec "$TARGET_HEX_SECRET")
RESTORE_ARGS="--config-dir $ROOT/restore-config"
# shellcheck disable=SC2086
redshift $RESTORE_ARGS configure set "relays=$RELAY"
export REDSHIFT_NSEC="$TARGET_NSEC"
if printf '%s\n' 'wrong backup passphrase' \
  | redshift $RESTORE_ARGS backup restore "$BACKUP_PATH" --allow-identity-change --passphrase-stdin >/dev/null 2>&1; then
  echo 'wrong backup passphrase unexpectedly succeeded' >&2
  exit 1
fi
cp "$BACKUP_PATH" "$ROOT/tampered.redshift"
SIZE=$(wc -c <"$ROOT/tampered.redshift")
LAST=$(tail -c 1 "$ROOT/tampered.redshift" | od -An -tu1)
FLIPPED=$((LAST ^ 1))
printf "\\$(printf '%03o' "$FLIPPED")" \
  | dd of="$ROOT/tampered.redshift" bs=1 seek=$((SIZE - 1)) conv=notrunc 2>/dev/null
if printf '%s\n' "$BACKUP_PASSPHRASE" \
  | redshift $RESTORE_ARGS backup restore "$ROOT/tampered.redshift" --allow-identity-change --passphrase-stdin >/dev/null 2>&1; then
  echo 'tampered backup unexpectedly succeeded' >&2
  exit 1
fi
printf '%s\n' "$BACKUP_PASSPHRASE" \
  | redshift $RESTORE_ARGS backup restore "$BACKUP_PATH" --allow-identity-change --passphrase-stdin
RESTORED=$(redshift $RESTORE_ARGS secrets get API_KEY --raw --project release-container --config production)
[ "$RESTORED" = release-container-secret ]

export REDSHIFT_NSEC
REDSHIFT_NSEC=$(nak encode nsec "$HEX_SECRET")
# shellcheck disable=SC2086
redshift $GLOBAL_ARGS secrets delete API_KEY --project release-container --config production
if redshift $GLOBAL_ARGS secrets get API_KEY --raw --project release-container --config production >/dev/null 2>&1; then
  echo 'deleted secret remained readable' >&2
  exit 1
fi

UPGRADE_OUTPUT=$(redshift $GLOBAL_ARGS upgrade --force --tag "$EXPECTED_TAG")
printf '%s' "$UPGRADE_OUTPUT" | grep -F "Successfully upgraded to v$EXPECTED_VERSION" >/dev/null
redshift --version | grep -F "$EXPECTED_VERSION" >/dev/null

unset REDSHIFT_NSEC HEX_SECRET TARGET_HEX_SECRET TARGET_NSEC BACKUP_PASSPHRASE
printf 'Fresh release journey passed for %s/%s\n' "$(uname -s)" "$(uname -m)"
