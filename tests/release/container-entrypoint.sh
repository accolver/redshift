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
  if timeout 2 nak count -k 1 "$RELAY" >/dev/null 2>&1; then
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

cat >"$ROOT/inspect.sh" <<'SCRIPT'
#!/bin/sh
printf '%s|%s' "$API_KEY" "${REDSHIFT_NSEC-unset}"
SCRIPT
chmod 0755 "$ROOT/inspect.sh"
RUN_OUTPUT=$(redshift $GLOBAL_ARGS run --project release-container --config production -- "$ROOT/inspect.sh")
[ "$RUN_OUTPUT" = 'release-container-secret|unset' ]

# shellcheck disable=SC2086
redshift $GLOBAL_ARGS secrets delete API_KEY --project release-container --config production
if redshift $GLOBAL_ARGS secrets get API_KEY --raw --project release-container --config production >/dev/null 2>&1; then
  echo 'deleted secret remained readable' >&2
  exit 1
fi

UPGRADE_OUTPUT=$(redshift $GLOBAL_ARGS upgrade --force --tag "$EXPECTED_TAG")
printf '%s' "$UPGRADE_OUTPUT" | grep -F "Successfully upgraded to v$EXPECTED_VERSION" >/dev/null
redshift --version | grep -F "$EXPECTED_VERSION" >/dev/null

unset REDSHIFT_NSEC HEX_SECRET
printf 'Fresh release journey passed for %s/%s\n' "$(uname -s)" "$(uname -m)"
