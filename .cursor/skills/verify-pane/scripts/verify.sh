#!/bin/sh
# Fixture proof only. Never launches or connects to Zen.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
cd "$root"
evidence=$(mktemp -d "${TMPDIR:-/tmp}/pane-proof.XXXXXX")
printf '%s\n' "$evidence"
{ git rev-parse HEAD; git status --short; node --version; npm --version; } > "$evidence/identity.txt"
if npm test > "$evidence/npm-test.txt" 2>&1; then
  printf 'PASS npm test\n' > "$evidence/result.txt"
else
  printf 'FAIL npm test\n' > "$evidence/result.txt"
  cat "$evidence/npm-test.txt"
  exit 1
fi
if git fetch origin main:refs/remotes/origin/main > "$evidence/fetch-main.txt" 2>&1; then
  printf 'PASS fetch origin main\n' >> "$evidence/result.txt"
else
  printf 'FAIL fetch origin main\n' >> "$evidence/result.txt"
  cat "$evidence/fetch-main.txt"
  exit 1
fi
base=$(git merge-base HEAD origin/main)
if git diff --check "$base"...HEAD > "$evidence/diff-check.txt" 2>&1; then
  printf 'PASS git diff --check %s...HEAD\n' "$base" >> "$evidence/result.txt"
else
  printf 'FAIL git diff --check %s...HEAD\n' "$base" >> "$evidence/result.txt"
  cat "$evidence/diff-check.txt"
  exit 1
fi
printf 'Native Zen: NOT RUN. Follow SKILL.md and mapped recipes.\n' >> "$evidence/result.txt"
cat "$evidence/result.txt"
