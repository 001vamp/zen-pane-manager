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
if git diff --check > "$evidence/diff-check.txt" 2>&1; then
  printf 'PASS git diff --check\n' >> "$evidence/result.txt"
else
  printf 'FAIL git diff --check\n' >> "$evidence/result.txt"
  exit 1
fi
printf 'Native Zen: NOT RUN. Follow SKILL.md and mapped recipes.\n' >> "$evidence/result.txt"
cat "$evidence/result.txt"
