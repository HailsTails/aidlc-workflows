#!/usr/bin/env bash
# Install proof (rin lock amendment A2): copy exactly the README's install path
# list into a CommonJS consumer and run both commands under both mechanisms.
# A check, not a test: it writes a temporary directory and spawns node.
set -euo pipefail

PACKAGE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Inside the package, so Node resolves dependencies by walking up to the
# repository's node_modules on every platform, with no symlink.
WORK="$(mktemp -d "$PACKAGE/.install-proof.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

expect() {
  local expected="$1" text="$2"; shift 2
  local actual=0
  "$@" >"$WORK/out.txt" 2>&1 || actual=$?
  local seen=yes
  if [ -z "$text" ]; then [ -s "$WORK/out.txt" ] && seen=no; else grep -qF -- "$text" "$WORK/out.txt" || seen=no; fi
  if [ "$actual" != "$expected" ] || [ "$seen" = no ]; then
    echo "FAIL: expected exit $expected and \"$text\", got exit $actual: $*" >&2
    cat "$WORK/out.txt" >&2
    exit 1
  fi
  echo "ok: $1 $(basename "$2") -> exit $actual, \"$text\""
}

consumer() {
  local mechanism="$1" repo="$WORK/${2:-$1}"
  mkdir -p "$repo"
  cp -r "$PACKAGE/tests/test-fixtures/consumer-proof/$mechanism/." "$repo/"
  printf '{ "type": "commonjs" }\n' >"$repo/package.json"
  local install="$repo/.rin/dc"
  mkdir -p "$install/rules" "$install/mechanisms/$mechanism"
  cp "$PACKAGE/package.json" "$install/"
  cp -r "$PACKAGE/core" "$install/"
  cp -r "$PACKAGE/rules/CD-14" "$install/rules/"
  cp -r "$PACKAGE/mechanisms/$mechanism/runner" "$PACKAGE/mechanisms/$mechanism/CD-14" "$install/mechanisms/$mechanism/"
  find "$install" \( -name '*.test.ts' -o -name tests -o -name test-fixtures \) -prune -exec rm -rf {} +
  git -C "$repo" init -q
  git -C "$repo" add -A
  git -C "$repo" -c user.name=proof -c user.email=proof@invalid commit -qm consumer
}

commit_all() {
  git -C "$1" add -A
  git -C "$1" -c user.name=proof -c user.email=proof@invalid commit -qm "$2"
}

check() { node "$1/.rin/dc/core/check/check-command.ts" --repo "$1" --base-revision HEAD; }
project() { node "$1/.rin/dc/core/check/project-command.ts" --repo "$1"; }

consumer walker
expect 1 "verdict: fail" check "$WORK/walker"
rm "$WORK/walker/src/kept.ts"
commit_all "$WORK/walker" clean
expect 0 "verdict: pass" check "$WORK/walker"
expect 0 "" project "$WORK/walker" # the walker writes nothing, so output is empty

consumer eslint
expect 0 "disciplines.eslint.mjs written" project "$WORK/eslint"
commit_all "$WORK/eslint" project
expect 1 "verdict: fail" check "$WORK/eslint"
rm "$WORK/eslint/src/kept.ts"
commit_all "$WORK/eslint" clean
expect 0 "verdict: pass" check "$WORK/eslint"

consumer walker no-package-json
rm "$WORK/no-package-json/.rin/dc/package.json"
expect 1 "Cannot use import statement outside a module" check "$WORK/no-package-json"

echo "install proof: pass"
