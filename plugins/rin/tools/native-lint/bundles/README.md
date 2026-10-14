# Opt-in CD-42 and CD-44 lint bundles

These are **partial, per-discipline** checks using built-in linter rules. Choose
the CDs and the lint engine your repository already uses; copying a bundle does
not enable it. No AIDLC stage, hook, Rin gate, plugin selector or carve-out
adapter is installed. Read the full [CD-42](../../../knowledge/aidlc-shared/code-discipline/cd-042-unhappy-path-early-return.md)
and [CD-44](../../../knowledge/aidlc-shared/code-discipline/cd-044-no-parameter-field-mutation.md)
text before adopting either rule. The [standalone guide](../../../knowledge/aidlc-shared/code-discipline/standalone-adoption.md)
covers source packaging, initial-debt inventory and manual fresh-chat use.

## Copy the generated assets

Use an immutable Rin source revision **containing this directory**. The older
pin in a prior standalone-guide copy predates these files. Take the full source
commit SHA from the release or PR that supplied this bundle, check out that
commit, and enter it below; the command verifies the checkout and committed
asset before copying. With Bun installed in the source checkout, run the
existing packager for your harness. This Cursor example assumes `consumer` is
the path to an existing repo and stops before overwriting an existing bundle
directory or copying through a harness-directory symlink:

```bash
(
  set -e
  source_checkout=$(pwd)
  read -r -p 'Full pinned Rin source commit SHA: ' expected_source_commit
  read -r -p 'Existing consumer repository directory: ' consumer
  consumer=$(cd "$consumer" && pwd)
  test "${#expected_source_commit}" -eq 40
  test "$(git rev-parse HEAD)" = "$expected_source_commit"
  test -z "$(git status --porcelain)"
  git cat-file -e 'HEAD:plugins/rin/tools/native-lint/bundles/cd42.eslint.json'
  bun install --frozen-lockfile
  projection="$source_checkout/dist/plugins/rin/cursor"
  bun scripts/package.ts plugin build rin cursor "$projection"
  for asset in cd42.eslint.json cd44.eslint.json cd42.biome.json cd44.biome.json cd42.oxlint.json cd44.oxlint.json README.md; do
    test -f "$projection/tools/native-lint/bundles/$asset"
  done
  test ! -L "$consumer/.cursor"
  test ! -L "$consumer/.cursor/tools"
  test ! -L "$consumer/.cursor/tools/native-lint"
  test ! -e "$consumer/.cursor/tools/native-lint/bundles"
  test ! -L "$consumer/.cursor/tools/native-lint/bundles"
  mkdir -p "$consumer/.cursor/tools/native-lint"
  cp -R "$projection/tools/native-lint/bundles" "$consumer/.cursor/tools/native-lint/bundles"
)
```

Run this from the pinned producer root, not the consumer. For Codex or Claude,
change the harness argument and both `cursor`/`.cursor` path segments together.
Record the source commit and compare assets before a later update. Remove only
copies and config entries this adoption owns; there is no selective uninstall.
If updating a prior `.mjs` bundle copy, replace its imports with the JSON reads
below and remove only the old owned files after the lint check passes.

## Enable only selected checks in the consumer

For **ESLint**, read one or both generated JSON rule maps in the existing
flat config. Spread the selected rule maps into the existing TypeScript/TSX
`rules` block, keeping its parser, plugins, other rules, file patterns and lint
script. These maps add no parser or plugin and do not select file scope. Add
the selected reads at the top of an existing ESM flat config:

```js
import { readFileSync } from 'node:fs';

const cd42EslintRules = JSON.parse(readFileSync(
  new URL('./.cursor/tools/native-lint/bundles/cd42.eslint.json', import.meta.url), 'utf8',
));
const cd44EslintRules = JSON.parse(readFileSync(
  new URL('./.cursor/tools/native-lint/bundles/cd44.eslint.json', import.meta.url), 'utf8',
));
```

These are plain data files; the consumer ESLint config loads them with Node and
does not need Bun or generated executable bundle code. Then add these spreads
inside its existing applicable `rules` object, retaining
all current entries:

```js
...cd42EslintRules,
...cd44EslintRules,
```

For **Biome 2.4.16**, append only the selected paths to the consumer's existing
`biome.json` `extends` array; keep its other settings and rule overrides. The
current file is applied last, so check that it does not turn a selected rule off:

```json
"extends": [
  "./.cursor/tools/native-lint/bundles/cd42.biome.json",
  "./.cursor/tools/native-lint/bundles/cd44.biome.json"
]
```

For **Oxlint 1.87.0**, append only selected paths to an existing
`.oxlintrc.json` `extends` array. These fragments contain rules only; preserve
the consumer's `plugins`, categories, other rules, ignores and lint command.
If the consumer explicitly lists plugins, keep its current entries and include
the `eslint` plugin for these core rule IDs:

```json
"extends": [
  "./.cursor/tools/native-lint/bundles/cd42.oxlint.json",
  "./.cursor/tools/native-lint/bundles/cd44.oxlint.json"
]
```

The JSON excerpts are properties to merge into an existing config, not whole
replacement files. Use the consumer's existing package manager and lint script;
do not install another linter merely to adopt these examples. Include intended
source, test, TSX and applicable JS paths. Existing findings require an explicit
scope/debt decision before requiring a new rule; initial inventory needs no Five
Whys. These bundles do not read `.constitution-carve-outs` or enforce CD-46.

CD-42 uses ESLint/Oxlint `no-else-return` with `allowElseIf: false`, or Biome
`noUselessElse`. Each catches an `else`/`else if` after an early `return`.
Biome also flags redundant `else` after other control-flow exits. A happy-first
body without `else` still passes all three; review guard ordering and the final
happy return manually.

CD-44 uses ESLint/Oxlint `no-param-reassign` with `props: true`, or Biome
`noParameterAssign` with `propertyAssignment: "deny"`. Each catches direct
parameter property writes. Each also bans **parameter rebinding**, beyond the
CD-44 field-only prohibition. Input `push`/`sort`, aliases, shared nested children
after a shallow copy, and effects inside callees can pass; review those manually.
No blanket immutable-data policy or automatic CD-44 compliance is claimed.

Prove the chosen engine and actual file population with one unused `.ts` and
`.test.ts` probe: an `else` after return and an input property assignment must
fail the existing lint command; remove `else`, return a fresh value without
mutating input, then repeat the same command and expect a pass. Recheck a host
rule to ensure the selected fragments did not replace existing configuration.
Run the repo's existing typecheck, tests and build before handoff.
