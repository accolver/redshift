#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TAG=${1:-}
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  echo "usage: GH_TOKEN=... bun run test:release:containers -- vX.Y.Z" >&2
  exit 2
fi
if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN is required for GitHub API and attestation verification" >&2
  exit 2
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is unavailable" >&2
  exit 2
fi

current_image=
cleanup() {
  if [[ -n "$current_image" ]]; then
    docker image rm "$current_image" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

platforms=(linux/amd64 linux/arm64)
for platform in "${platforms[@]}"; do
  arch=${platform#linux/}
  image="redshift-release-test:${TAG#v}-${arch}"
  current_image=$image
  echo "==> Building fresh-install image for $platform"
  docker buildx build \
    --platform "$platform" \
    --file "$ROOT/tests/release/Dockerfile" \
    --tag "$image" \
    --load \
    "$ROOT"
  echo "==> Running public release journey for $platform"
  docker run --rm \
    --platform "$platform" \
    --env GH_TOKEN \
    "$image" "$TAG"
  docker image rm "$image" >/dev/null
  current_image=
  echo "==> Passed $platform"
done

echo "Linux release container matrix passed for $TAG"
echo "macOS is intentionally validated only on native Darwin runners/hosts."
