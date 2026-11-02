#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

# A worktree made by scripts/worktree-setup.sh records its slot in .env. Slot 0 is the plain
# checkout; any other slot shifts the ports and the Compose project so runs do not collide.
if [ -z "${E2E_SLOT:-}" ]; then
  E2E_SLOT=$(sed -n 's/^WORKTREE_SLOT=//p' .env 2>/dev/null | tail -n 1)
fi
case "${E2E_SLOT:-0}" in
  [0-9]) ;;
  *)
    printf '%s\n' "E2E_SLOT must be a single digit, got '$E2E_SLOT'." >&2
    exit 2
    ;;
esac
E2E_SLOT=${E2E_SLOT:-0}

set -a
. ./.env.e2e
if [ "$E2E_SLOT" -ne 0 ]; then
  PORT=$((PORT + E2E_SLOT))
  POSTGRES_HOST_PORT=$((POSTGRES_HOST_PORT + E2E_SLOT))
  SMTP_HOST_PORT=$((SMTP_HOST_PORT + E2E_SLOT))
  MAILPIT_HOST_PORT=$((MAILPIT_HOST_PORT + E2E_SLOT))
  BASE_URL="${BASE_URL%:*}:$PORT"
  MAILPIT_URL="${MAILPIT_URL%:*}:$MAILPIT_HOST_PORT"
  DATABASE_PORT=$POSTGRES_HOST_PORT
  SMTP_PORT=$SMTP_HOST_PORT
  COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME-$E2E_SLOT"

  # playwright.config.ts reads this copy instead of .env.e2e, so it sees the same values.
  E2E_ENV_FILE=$(mktemp "${TMPDIR:-/tmp}/jts-e2e-env.XXXXXX")
  {
    cat .env.e2e
    printf '\n'
    for name in PORT POSTGRES_HOST_PORT SMTP_HOST_PORT MAILPIT_HOST_PORT BASE_URL MAILPIT_URL \
      DATABASE_PORT SMTP_PORT COMPOSE_PROJECT_NAME; do
      eval "printf '%s=%s\\n' \"\$name\" \"\$$name\""
    done
  } >"$E2E_ENV_FILE"
fi
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
  if [ -n "${E2E_ENV_FILE:-}" ]; then rm -f "$E2E_ENV_FILE"; fi
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

compose up --detach --wait
pnpm build
pnpm exec playwright test "$@"
