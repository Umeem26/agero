#!/usr/bin/env bash
# Honesty gate: fails (exit 1) if overclaiming phrases appear in the UI source or README.
# Usage: tool/honesty_gate.sh [path ...]   (defaults to frontend/src and README.md)
set -euo pipefail

BANNED_PHRASES=(
  "Payment VERIFIED"
  "real transaction hash"
  "registered on-chain"
  "refunded on dispute"
)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "$#" -gt 0 ]; then
  TARGETS=("$@")
else
  TARGETS=("$ROOT/frontend/src" "$ROOT/README.md")
fi

fail=0
for phrase in "${BANNED_PHRASES[@]}"; do
  # Escape regex metacharacters instead of using -F: some grep builds (Git Bash grep 3.0) abort on -iF
  pattern=$(printf '%s' "$phrase" | sed 's/[][\.*^$/]/\\&/g')
  # -I skips binary files (images), -i ignores case
  rc=0
  hits=$(grep -rnIi -e "$pattern" -- "${TARGETS[@]}") || rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "BANNED phrase \"$phrase\":"
    echo "$hits"
    fail=1
  elif [ "$rc" -ne 1 ]; then
    echo "Honesty gate ERROR: grep exited with code $rc while checking \"$phrase\"."
    exit 2
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "Honesty gate FAILED: remove or reword the phrases above."
  exit 1
fi
echo "Honesty gate passed (${#BANNED_PHRASES[@]} phrases checked in ${#TARGETS[@]} targets)."
