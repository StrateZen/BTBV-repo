#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: this script must be run inside a git repository." >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "main" ]]; then
  echo "Error: current branch is '$current_branch'. Switch to 'main' before pushing." >&2
  exit 1
fi

if [[ -n "$(git status --short)" ]]; then
  echo "Error: working tree is not clean. Commit or stash changes before pushing." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Error: git remote 'origin' is not configured." >&2
  exit 1
fi

echo "Pushing main to origin..."
git push origin main

echo "Done."
