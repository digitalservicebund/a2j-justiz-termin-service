#!/bin/sh
# Stop and delete the Docker services of a worktree made by scripts/worktree-setup.sh.
# Run it before `git worktree remove`. It refuses to run without a worktree slot in .env,
# so it can never take down the main checkout's database.
set -eu

cd "$(dirname "$0")/.."

slot=$(sed -n 's/^WORKTREE_SLOT=//p' .env 2>/dev/null | tail -n 1)
if [ -z "$slot" ]; then
  printf '%s\n' "No WORKTREE_SLOT in .env: this is not a set-up worktree, refusing to remove services." >&2
  exit 1
fi

docker compose --project-name "jts-slot-$slot" down --volumes --remove-orphans
docker compose --project-name "jts-e2e-$slot" down --volumes --remove-orphans
printf '%s\n' "Removed the services of slot $slot. Now run: git worktree remove $(pwd -P)"
