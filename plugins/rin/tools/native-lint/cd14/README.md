# CD-14 native lint fragments

This opt-in slice supplies one dedicated ESLint/Oxlint rule. Consumers add native
fragments to their existing config. There is no composer or generated host config.

Fetch the source directory from a reviewed commit, independently of any harness:

```bash
mkdir -p .rin/native-lint
curl -fsSL "https://codeload.github.com/HailsTails/aidlc-workflows/tar.gz/<reviewed-commit-sha>" \
  | tar -xz -C .rin/native-lint --strip-components=5 --wildcards --exclude='*.test.ts' '*/plugins/rin/tools/native-lint/*'
```

Replace `<reviewed-commit-sha>` with the full pinned commit ID. Commit
`.rin/native-lint/` and record that ID in the commit message. Update by fetching a
new reviewed pin and reviewing the diff. This fetch excludes producer tests and
requires no consumer build step. Oxlint resolves its plugin path against the
extended fragment. The consumer path is always `.rin/native-lint/`.

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
22.18 or later through native type stripping; Oxlint loads `plugin.ts` the
same way. A separate TypeScript-config loader is needed only if the consumer's
own ESLint config is `eslint.config.ts`.
The producer does not ship a TypeScript parser dependency to consumers.

For Oxlint, append `./.rin/native-lint/cd14.oxlint.json` to the existing root
config's `extends`. Keep existing rules, includes, and lint scripts.

The previously exercised native versions are Bun 1.3.14, ESLint 10.12.0,
`@typescript-eslint/parser` 8.71.2, and Oxlint 1.88.0. A consumer needs only its
selected engine and existing parser. Oxlint JS plugins are alpha. Repositories
using another linter can run Oxlint alongside it.

## Separate canonical carve projection

The fetched source includes the separate carve tool. Add `zod` 4.4.3 as a
consumer dev dependency only when using this projection (for example,
`npm install --save-dev zod@4.4.3`). Generate overrides for exactly the
CDs adopted by the consumer:

```bash
node .rin/native-lint/carve-files.ts --cd CD-14 --cd CD-42 --cd CD-44
node .rin/native-lint/carve-files.ts --cd CD-14 --cd CD-42 --cd CD-44 --check
```

Use the same explicit selection in generation and CI. `--project-dir` selects a
consumer root; the default is the current directory. The command reads matching
canonical `.constitution-carve-outs/cd-*.json` files and writes
`.rin/native-lint/carve.eslint.json` and `carve.oxlint.json`. Sidecars for
unselected CDs do not suppress anything. The small rule ownership map currently
covers CD14, CD42 and CD44; extend it when adding further native fragments.

Append the generated ESLint carve array after the selected native entries using
an ordinary JSON import:

```js
import carve from "./.rin/native-lint/carve.eslint.json" with { type: "json" };

export default [...existingHostEntries, ...selectedNativeEntries, ...carve];
```

Append `./.rin/native-lint/carve.oxlint.json` after the selected native fragments
in the Oxlint root config's `extends`. Commit both generated carve files. Run
`--check` before lint in CI: it regenerates expected bytes in memory and fails
on missing or edited files without writing. A shared rule ID claimed by two
selected CDs is refused rather than switched off for one CD. The projection
preserves host rules with other IDs. Keep independently required restrictions
under separate IDs; a host restriction using the same carved ID would also be
disabled by that native override.

The projector consumes file arrays only. It does not grant exemptions, validate
why-chains, or check touched files. Keep canonical sidecar eligibility and CD46
decay checks in review/CI. A concrete decay gate from a pinned producer checkout:

```bash
bun plugins/rin/tools/rin-harness-carve-out-decay.ts --project-dir "$consumer" --base-ref "$review_base" --json
```

Use an actual resolvable Git review base. The existing synthetic adopter verified
committed and uncommitted carve touches fail this gate; remediation and sidecar
removal restore green. Native lint alone does not run the Git gate.

## Rule ownership and limits

`cd14/plugin.ts` is the recorded CD19 owner of the ESLint callback/type adapter.
The native rule export is the engine boundary used by RuleTester; the diagnostic
port exposes owned contracts to the classification logic. The rule has no runtime
package dependency. `carve-files.ts` owns filesystem and consumed-JSON validation;
`carve-projection.ts` has no external dependency. The source tool consumes the optional consumer Zod dependency directly.

The dedicated ID is `rin-discipline/no-class-authoring`. Runtime class
declarations and expressions are rejected, including nested, non-exported and
default-export classes. Ambient declarations and classes enclosed by ambient
namespace/module/global declarations are allowed, as are `.d.ts`, `.d.cts`, and
`.d.mts` declarations. External `new LibraryClass()` calls remain allowed.
Syntax enforcement does not establish external dependency provenance or wrapper
placement. CD15 remains deferred because a blanket loop rule would ignore its
authorised async drains. No broader CD coverage is claimed by this slice.
