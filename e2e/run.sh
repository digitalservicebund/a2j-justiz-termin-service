#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
set -a
. ./.env.e2e
set +a

compose() {
  docker compose --project-name "$COMPOSE_PROJECT_NAME" --file docker-compose.yml "$@"
}

cleanup() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    compose logs --no-color || printf '%s\n' 'Could not retrieve E2E service logs.' >&2
  fi
  compose down --volumes || status=1
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

compose up --detach --wait
pnpm build
pnpm exec playwright test "$@"
