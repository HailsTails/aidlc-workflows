# Opt-in CD-42 and CD-44 lint bundles

These are **partial, per-discipline** checks using built-in ESLint and Oxlint
rules. Select CD-42 and/or CD-44, then enable the corresponding fragment;
fetching files does not enable checks. No AIDLC stage, hook, Rin gate, plugin
selector or carve-out adapter is installed. Before adopting a rule, read its
canonical file at the same pinned source revision:
`plugins/rin/knowledge/aidlc-shared/code-discipline/cd-042-unhappy-path-early-return.md`
or `plugins/rin/knowledge/aidlc-shared/code-discipline/cd-044-no-parameter-field-mutation.md`.
This lint-only fetch does not install the canonical knowledge files.

## Install pinned native-lint sources

Run this Bash command from the root of an existing consumer repository. It
requires Git, curl and GNU tar (Git Bash on Windows). Enter a full, public Rin
source commit SHA containing these bundles; the older standalone-guide pin
predates them. The command fetches the authored source directory into the fixed
`.rin/native-lint/` path without Bun or a harness build. It refuses to overwrite
an existing install, refuses a symlinked `.rin` path, excludes source tests and
checks the four selected-engine assets plus this README:

```bash
(
  set -euo pipefail
  test -e .git
  read -r -p 'Full pinned Rin source commit SHA: ' rin_source_sha
  [[ "$rin_source_sha" =~ ^[0-9a-f]{40}$ ]]
  test ! -L .rin
  test ! -e .rin/native-lint
  test ! -L .rin/native-lint
  mkdir -p .rin/native-lint
  curl -fsSL "https://codeload.github.com/HailsTails/aidlc-workflows/tar.gz/$rin_source_sha" \
    | tar -xz -C .rin/native-lint --strip-components=5 --wildcards \
      --exclude='*.test.ts' '*/plugins/rin/tools/native-lint/*'
  for asset in cd42.eslint.json cd44.eslint.json cd42.oxlint.json cd44.oxlint.json README.md; do
    test -f ".rin/native-lint/bundles/$asset"
  done
)
```

Commit `.rin/native-lint/` to the consumer and record the full source SHA in
that commit message. For an update, review the new source revision and compare
it with the installed files. This command refuses overwrite: replace only
`.rin/native-lint/` files owned by this adoption, rerun with the new SHA, review
the diff and commit the updated pin. If migrating from an earlier harness-path
copy, update config references to the paths below, verify lint, then remove only
the old owned files and references. There is no selective uninstall.

## Enable only selected checks in the consumer

For **ESLint**, read one or both fetched JSON rule maps in the existing
flat config. Spread the selected rule maps into the existing TypeScript/TSX
`rules` block, keeping its parser, plugins, other rules, file patterns and lint
script. These maps add no parser or plugin and do not select file scope. Add
the selected reads at the top of an existing ESM flat config:

```js
import { readFileSync } from 'node:fs';

const cd42EslintRules = JSON.parse(readFileSync(
  new URL('./.rin/native-lint/bundles/cd42.eslint.json', import.meta.url), 'utf8',
));
const cd44EslintRules = JSON.parse(readFileSync(
  new URL('./.rin/native-lint/bundles/cd44.eslint.json', import.meta.url), 'utf8',
));
```

These are plain data files; the consumer ESLint config loads them with Node and
does not need Bun or executable bundle code. Then add these spreads
inside its existing applicable `rules` object, retaining
all current entries:

```js
...cd42EslintRules,
...cd44EslintRules,
```

For **Oxlint 1.87.0**, append only selected paths to an existing
`.oxlintrc.json` `extends` array. These fragments contain rules only; preserve
the consumer's `plugins`, categories, other rules, ignores and lint command.
If the consumer explicitly lists plugins, keep its current entries and include
the `eslint` plugin for these core rule IDs:

```json
"extends": [
  "./.rin/native-lint/bundles/cd42.oxlint.json",
  "./.rin/native-lint/bundles/cd44.oxlint.json"
]
```

If `.oxlintrc.json` does not exist, create it as a JSON object with only the
selected fragments (this example selects both):

```json
{
  "extends": [
    "./.rin/native-lint/bundles/cd42.oxlint.json",
    "./.rin/native-lint/bundles/cd44.oxlint.json"
  ]
}
```

The Oxlint `extends` excerpt is a property to merge into an existing config,
not a whole replacement file. Use the consumer's existing package manager and
validation scripts. If neither engine is installed, add pinned Oxlint alongside
the existing linter. For the tested pnpm consumer workspace, run
`pnpm add -Dw --save-exact oxlint@1.87.0 --ignore-scripts` and include
`pnpm exec oxlint apps packages` in its existing validation command. Adjust
paths to include source, tests, TSX and applicable JS; keep other lint checks.
Existing findings require an explicit
scope/debt decision before requiring a new rule; initial inventory needs no Five
Whys. These bundles do not read `.constitution-carve-outs` or enforce CD-46.

CD-42 uses ESLint/Oxlint `no-else-return` with `allowElseIf: false`. Both
catch an `else`/`else if` after an early `return`. A happy-first body without
`else` still passes both; review guard ordering and the final happy return
manually.

CD-44 uses ESLint/Oxlint `no-param-reassign` with `props: true`. Both catch
direct parameter property writes. Each also bans **parameter rebinding**, beyond
the CD-44 field-only prohibition. Input `push`/`sort`, aliases, shared nested children
after a shallow copy, and effects inside callees can pass; review those manually.
No blanket immutable-data policy or automatic CD-44 compliance is claimed.

Prove the chosen engine and actual file population with one unused `.ts` and
`.test.ts` probe: an `else` after return and an input property assignment must
fail the existing lint command; remove `else`, return a fresh value without
mutating input, then repeat the same command and expect a pass. Recheck a host
rule to ensure the selected fragments did not replace existing configuration.
Run the repo's existing typecheck, tests and build before handoff.
