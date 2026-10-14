# CD-14 native lint slice

This is an opt-in, local CD-14 rule. `plugin.mjs` is one ordinary ESLint plugin;
Oxlint loads that **same file** through `jsPlugins`. `no-class-authoring.grit` is a
separate Biome equivalent. `config.mjs` and `compose.mjs` read the canonical
`.constitution-carve-outs/cd-14.json` location and translate exact carved files
into native CD-14-only exclusions. None of these files imports an AIDLC stage,
hook, sensor, package runtime or npm-published Rin plugin.

## Install one selected native slice

Build the Rin projection with the producer's pinned Bun install:

```bash
bun install --frozen-lockfile
bun scripts/package.ts plugin build rin cursor "$PWD/dist/plugins/rin/cursor"
```

Copy only `dist/plugins/rin/cursor/tools/native-lint/cd14/` into the existing
consumer's `.rin/native-lint/cd14/`. The same relative tools path is produced by
other harness projections. Commit those local files so lint works in CI and
editors without a producer checkout. The consumer chooses its own existing lint
population and keeps its parser, config, package manager, rules and scripts. The
examples below use Bun because the fresh adopter proof is Bun-managed; an existing
npm/pnpm/Yarn consumer keeps its manager and equivalent pinned dependencies.

The verified fresh-adopter versions are Bun **1.3.14**, ESLint **10.12.0**,
`@typescript-eslint/parser` **8.71.2**, Oxlint **1.88.0** and Biome **2.5.15**.
Its `bun.lock` was created, committed and checked with `bun install
--frozen-lockfile`. A consumer needs only the engine it already uses. ESLint
requires a compatible parser for TS/TSX; the local CD-14 plugin has no package
dependencies. Oxlint JS plugins are alpha. Biome's Grit diagnostic category is
generic `plugin`, so keep one Grit file and include filter per CD.

## ESLint: append to the host flat config

Keep existing entries, including `no-restricted-syntax`, then append the returned
CD-14 entries. Add source and test globs that match the consumer's actual lint
command. For example, inside the existing `eslint.config.mjs`:

```js
import { fileURLToPath } from "node:url";
import { eslintCd14 } from "./.rin/native-lint/cd14/config.mjs";

export default [
  ...existingHostEntries,
  ...eslintCd14({
    projectDir: fileURLToPath(new URL(".", import.meta.url)),
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
  }),
];
```

The existing `eslint src test` script remains the entrypoint. The adapter reads
the sidecar whenever ESLint loads the config. It registers only
`rin-discipline/no-class-authoring` and later file entries turn off only that
rule. It does not configure the TypeScript parser, reset host rules or apply a
global ignore.

## Oxlint or Biome: compose beside a preserved host config

Keep a reviewed copy of the existing `.oxlintrc.json` as
`.oxlintrc.host.json`, or `biome.json` as `biome.host.json`. The separate host file
remains user-owned. For Oxlint, prepend this command to the existing lint script
and leave its `oxlint ...` command after `&&`:

```bash
bun .rin/native-lint/cd14/compose.mjs --engine oxlint --host .oxlintrc.host.json --output .oxlintrc.json --plugin-path ./.rin/native-lint/cd14/plugin.mjs && oxlint --config .oxlintrc.json src test
```

For Biome, pass its plugin include population explicitly. Keep the existing
`biome lint ...` command after `&&`:

```bash
bun .rin/native-lint/cd14/compose.mjs --engine biome --host biome.host.json --output biome.json --plugin-path ./.rin/native-lint/cd14/no-class-authoring.grit --include '**/src/**' --include '**/test/**' --include '!**/*.d.ts' && biome lint --config-path biome.json src test
```

Composition fails before writing if the sidecar is malformed, refers to a
missing/outside/glob path, or if the host already owns the dedicated Oxlint rule
or loads the same Biome plugin. Oxlint appends `jsPlugins`, rules and exact-file
overrides to host data. Biome extends the host and scopes its one CD-14 Grit file
with `plugins[].includes`, including negative globs for carved files. The host's
built-in lint rules still run on carved files. Do not put the same CD-14 Grit
plugin in the host config: Biome concatenates plugin arrays under `extends`.

## Governance and composition boundary

A sidecar entry needs `files`, `reason` and `decision`; the adapter checks this
mechanical subset and does **not** grant a carve-out. Keep sidecar eligibility and
why-chain review plus the canonical CD-46 decay gate in the adopter's review/CI
path. From a pinned producer checkout with its frozen Bun dependencies, one
concrete CD-46 gate invocation is:

```bash
bun plugins/rin/tools/rin-harness-carve-out-decay.ts --project-dir "$consumer" --base-ref "$review_base" --json
```

Use an actual resolvable Git review base. The checker returns nonzero if a carved
file was touched. The synthetic adopter exercised this exact checker against both
uncommitted and committed edits; whole-file remediation and sidecar removal
restored green checks. Native lint alone does not run this Git gate. Do not use
inline linter comments as an assumed CD-14 exemption. CD-14 has no authored-class
authorised location.

The current canonical CD-14 sensor is a separate, narrower line-based audit. In
the synthetic adopter it accepted a carved class declaration, but missed a
carved class expression and marked that sidecar path stale; it also reported
classes inside ambient namespace/module/global declarations that the native
rule correctly treats as type-only. Its direct CLI emits a JSON `pass` field and
normally exits 0, so calling it directly is not an exit-code gate. If using the
Rin harness, keep its sensor/gate interpretation and inventory this mismatch.
Do not claim that a native-only class-expression carve satisfies the current
sensor; aligning the auditor is separate work. The CD-46 checker itself did
reject committed and uncommitted touches to that carved expression file.

This directory is independently copyable. Other opt-in per-CD bundles can live
beside it under `tools/native-lint/` and contribute their own config fragments
to the same host lint entrypoint. For example, an existing-rule bundle may export
`eslintCd42({ files })` for its precise core rule and options; a consumer appends
that fragment alongside `eslintCd14(...)`. A CD-specific carve-out may disable
an exclusively owned rule ID. If a builtin rule ID is shared by another selected
CD or a host restriction, an adapter must refuse a per-CD `off` override until
the owners are separated; it cannot switch that shared rule off for one CD.
This CD-14 slice disables only its dedicated ID.

The rule rejects runtime `ClassDeclaration` and `ClassExpression` syntax,
including nested, non-exported and default-export classes. It permits ambient
`declare class`, classes nested in `declare namespace`/`declare module`/`declare
global`, and `.d.ts` declarations as type-only, while still rejecting a runtime
namespace's class. It permits external
`new LibraryClass()` calls. This is syntax enforcement, not proof of external
dependency provenance, wrapper placement, or an instance staying internal.
Canonical CD-11 describes a single startup-invariant error class while CD-14
says zero authored classes; this slice applies literal CD-14 and does not invent
precedence. CD-15 remains manual here because its authorised async drains make
a blanket loop rule unfaithful.
