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

From the root of an existing consumer repository, use curl and GNU tar (Git
Bash on Windows). Replace the placeholder with a full public Rin source commit
SHA containing these bundles. This noninteractive command replaces the
`.rin/native-lint/` source directory; it needs no Bun or harness build:

```bash
RIN_SOURCE_SHA='PASTE_FULL_40_CHARACTER_COMMIT_SHA'
rm -rf .rin/native-lint && mkdir -p .rin/native-lint
curl -fsSL "https://codeload.github.com/HailsTails/aidlc-workflows/tar.gz/$RIN_SOURCE_SHA" \
  | tar -xz -C .rin/native-lint --strip-components=5 --wildcards --exclude='*.test.ts' '*/plugins/rin/tools/native-lint/*'
```

Review `git diff .rin/native-lint`, commit the fetched directory and record the
full source SHA in the consumer commit message.

## Enable only selected checks in the consumer

For **ESLint**, read one or both fetched JSON rule maps in the existing
flat config. Spread the selected rule maps into the existing TypeScript/TSX
`rules` block, keeping its parser, plugins, other rules, file patterns and lint
script. These maps add no parser or plugin and do not select file scope. Add
the selected native JSON imports at the top of an existing ESM flat config:

```js
import cd42EslintRules from './.rin/native-lint/bundles/cd42.eslint.json' with { type: 'json' };
import cd44EslintRules from './.rin/native-lint/bundles/cd44.eslint.json' with { type: 'json' };
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
validation scripts. If neither engine is installed, add pinned Oxlint as a dev
dependency with the consumer's package manager and include it in the existing
validation command. Keep other lint checks and include source, test, TSX and
applicable JS paths. Existing findings require an explicit
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
