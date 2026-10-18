# CD-14 native lint fragments

This opt-in slice supplies one dedicated rule for ESLint and Oxlint. Consumers add native
fragments to their existing config. There is no composer or generated host config.

Fetch a reviewed source pin into the replaceable managed directory. This requires
curl and GNU tar; run from the consumer's project root. Keep host configurations,
canonical carve sidecars and custom work outside `.rin/native-lint/`. Move any
existing custom work out before adopting this refresh route.

```bash
RIN_SOURCE_SHA=<full 40-character commit SHA>
rm -rf .rin/native-lint && mkdir -p .rin/native-lint
curl -fsSL "https://codeload.github.com/HailsTails/aidlc-workflows/tar.gz/$RIN_SOURCE_SHA" \
  | tar -xz -C .rin/native-lint --strip-components=5 --wildcards --exclude='*.test.ts' '*/plugins/rin/tools/native-lint/*'
```

Review `git diff .rin/native-lint`, commit the directory, and put the SHA in the
commit message. Extraction excludes producer tests and requires no consumer
build step. Oxlint resolves its plugin path against the extended fragment.

## Add to the existing config

For ESLint, import the flat-config entries in the existing `eslint.config.mjs`
and scope them to the consumer's actual source and test population:

```js
import cd14 from "./.rin/native-lint/cd14.eslint.ts";

export default [
  ...existingHostEntries,
  ...cd14.map((entry) => ({
    ...entry,
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
  })),
];
```

Keep the existing TypeScript parser and lint command. An ordinary
`eslint.config.mjs` imports this erasable TypeScript fragment on plain Node
22.18 or later through native type stripping; Oxlint loads `cd14/cd14.eslint-plugin.ts` the
same way. A separate TypeScript-config loader is needed only if the consumer's
own ESLint config is `eslint.config.ts`.
The producer does not ship a TypeScript parser dependency to consumers.

For Oxlint, append `./.rin/native-lint/cd14.oxlint.json` to the existing root
config's `extends`. Keep existing rules, includes, and lint scripts.

Producer RuleTester tests use the pinned ESLint 10.11.0. Separate native-loader
checks exercised Node 22.22.2, ESLint 10.12.0,
`@typescript-eslint/parser` 8.71.2, and Oxlint 1.88.0. A consumer needs only its
selected engine and existing parser. Oxlint JS plugins are alpha. Repositories
using another linter can run Oxlint alongside it.

The fragments don't read `.constitution-carve-outs`; exceptions are out of scope for this slice.

## Rule ownership and limits

ESLint and Oxlint load one CD14 rule source; the fragments select the same dedicated rule.
Oxlint uses its supported ESLint-compatible plugin protocol. The rule's
`create(context)` is its only boundary with the engine: it decides each class
with the pure `classDisposition` and reports through `context.report`. The rule
has no runtime package dependency.

The dedicated ID is `rin-discipline/no-class-authoring`. Runtime class
declarations and expressions are rejected, including nested, non-exported and
default-export classes. Ambient declarations and classes enclosed by ambient
namespace/module/global declarations are allowed, as are `.d.ts`, `.d.cts`, and
`.d.mts` declarations. External `new LibraryClass()` calls remain allowed.
Syntax enforcement does not establish external dependency provenance or wrapper
placement. CD15 remains deferred because a blanket loop rule would ignore its
authorised async drains. No broader CD coverage is claimed by this slice.
