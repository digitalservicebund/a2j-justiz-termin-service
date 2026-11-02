#!/usr/bin/env bash
# Prepare a fresh Claude Code cloud environment (or any clean Linux box) for this project.
#
# Use it as the environment's setup script, run from the cloned repository:
#   bash scripts/cloud-setup.sh
#
# It installs what the checks in AGENTS.md need: the pinned Node.js, pnpm, the dependencies and
# the Playwright browser. Postgres and Mailpit are only started when Docker works, because
# `pnpm test:e2e` and `pnpm dev` need them. Without Docker, lint, typecheck and unit tests
# still run, and the E2E tests are left to CI.
set -euo pipefail

cd "$(dirname "$0")/.."

node_version=$(awk '$1 == "nodejs" { print $2 }' .tool-versions)

if [ "$(node --version 2>/dev/null || true)" != "v$node_version" ]; then
  echo "Installing Node.js $node_version"
  case "$(uname -m)" in
    x86_64) node_arch=x64 ;;
    aarch64 | arm64) node_arch=arm64 ;;
    *)
      echo "Unsupported CPU architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
  download=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-$node_arch.tar.xz" |
    tar -xJ -C "$download" --strip-components=1
  # Replace the system Node.js so every shell picks up the pinned version.
  cp -rf "$download"/bin "$download"/include "$download"/lib "$download"/share /usr/local/
  rm -rf "$download"
fi

# The pnpm version is pinned by "packageManager" in package.json.
corepack enable
corepack prepare --activate >/dev/null 2>&1 || true

pnpm install --frozen-lockfile

# Browser for the E2E tests. The OS libraries need root, which a setup script normally has.
pnpm exec playwright install --with-deps chromium

# The git hooks are shared by all worktrees of a clone.
if command -v lefthook >/dev/null 2>&1; then lefthook install; fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker compose up --detach --wait
else
  echo "Docker is not available: skipping Postgres and Mailpit."
  echo "Lint, typecheck and unit tests work. pnpm dev and pnpm test:e2e need Docker."
fi

echo "Cloud setup finished."
