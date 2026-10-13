# Standalone code disciplines: TS API + React quick start

Adopt selected Rin code disciplines as repository standards using your normal lint,
typecheck and test commands. This is a **manual copy recipe**, not a plugin-selector
mode. The Rin plugin declares a dependency on AIDLC core; its full installer is
[documented separately](https://github.com/HailsTails/aidlc-workflows/blob/main/docs/guide/rin-fork-installation.md).
This recipe installs no AIDLC stages, scopes, hooks, Rin gates, private services,
MCP servers or workflow runtime. Copying prose does not activate enforcement.

## 1. Copy a pinned selection

Prerequisites: Git, an existing TS API + React repository, its supported Node and
package manager, and working ordinary checks. The verified example used Node
22.22.2, pnpm 10.33.2, TypeScript 6.0.3 and Biome 2.4.16 on Windows. Keep your
existing supported versions; the example is not a requirement to upgrade React
or replace your toolchain. The copy itself needs neither Bun nor a plugin install.

Run in PowerShell, starting **outside** your consumer repo. Choose a new producer
path and an existing consumer path. The source pin below is a verified public
fork revision, not an upstream release/version badge.

```powershell
git clone https://github.com/HailsTails/aidlc-workflows.git H:\Development\rin-rule-source
git -C H:\Development\rin-rule-source checkout --detach fb2908a5a06d51c75e6044b45788b5a70826ad54
$rinSource = 'H:\Development\rin-rule-source\plugins\rin\knowledge\aidlc-shared\code-discipline'
$consumer = 'H:\Development\my-api-react'
Set-Location $consumer
git switch -c adopt-selected-rin-disciplines
New-Item -ItemType Directory -Path docs\rin-disciplines -Force
Copy-Item -LiteralPath "$rinSource\cd-001-no-any.md", "$rinSource\cd-003-strict-mode-flags.md", "$rinSource\cd-046-decarve-on-touch.md" -Destination docs\rin-disciplines
```

Use a clean branch; inspect existing destination files before copying (Copy-Item
can overwrite them). Copy only the selected atomic rules, not the whole index:
the index describes Rin's full lens/workflow context. No source build is needed.
The same atomic files live in a built plugin's
`knowledge/aidlc-shared/code-discipline/`; this guide ships there too. Existing
packaging remains unchanged. Record the source commit with your copied artifacts.

## 2. Choose coverage before enabling checks

Read the selected files in full and record scope in `docs/rin-disciplines/adoption.md`:

| Selection | Deterministic coverage in this recipe | Review responsibility / gaps |
| --- | --- | --- |
| CD-1 | Biome 2.4.16 `noExplicitAny` and `noImplicitAnyLet`, errors on configured TS/TSX files | Not proof against all semantic propagation of `any`; CD-1 permits no carve-outs |
| CD-3 | Existing TypeScript compilation with seven flags below | Review effective inheritance and future config edits; ordinary compilation does not prevent weakening flags |
| CD-46, optional | None installed here | Whole touched exempt file must comply with its exempted rule and retire its exemption in the same change; never exempt CD-46 itself |

For an API, boundary validation (CD-4/45), result-shaped failures (CD-9/10/11) and
inward dependency direction (CD-12/13) may be useful next **manual** selections.
For React, first select type/test standards relevant to the component code;
do not silently apply server ports, ingress limits or RAM budgets to the browser.
Process rules CD-37/38/39 require deliberate adoption of their task/plan/review
obligations, not AIDLC stages. Read `applies-to`, `portability`, `status` and
`pairs-with` in each atomic file; collapsed IDs are redirects, not extra rules.
An enforcement tag names an available mechanism in Rin, not a tool installed here.

Preserve unrelated debt. Inventory findings only for selected rules and chosen
paths; record file, rule, reason, scope and reviewer for permitted initial inherited
debt. **Initial adoption/inventory requires no Five Whys**; DD-7/R7 is not selected.
Do not create CD-1 exemptions. If legacy `any` prevents full selection, choose an
explicit initially clean population and describe CD-1 as limited to that population.
Expand it deliberately; excluded files are uncovered, not compliant. With CD-46
selected, touching a permitted exempt file means whole-file paydown for its rule,
not just clean new lines. Without it, document your chosen new/touched-code policy
honestly; lint can check selected whole files, but this recipe has no automatic
changed-lines policy or exemption-decay checker.

## 3. Wire ordinary checks

For an existing ESLint repo, keep its lint command and configuration. If its
installed typescript-eslint plugin supports `@typescript-eslint/no-explicit-any`,
enable that rule as `error` in the existing TS/TSX scope. It covers explicit `any`,
not Biome's entire pair or semantic `any`. Use the existing TS compiler for implicit
`any`; review uncovered cases. No ESLint version/config migration is verified here.
Do not install a second linter just because a rule file names Biome.

For a repo with no linter, this is the verified minimal Biome path. In a pnpm
workspace root run (omit `-w` for a non-workspace):

```powershell
pnpm.cmd add -Dw --save-exact @biomejs/biome@2.4.16 --ignore-scripts
```

If already using Biome, merge the two errors into its existing configuration;
preserve existing rules and formatting. For a new `biome.json`, this copyable
example checks `apps` and `packages`, including tests and TSX, without formatting
or rewriting files. Change paths to match your repository; confirm it scans files.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.16/schema.json",
  "files": {
    "includes": ["apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts", "packages/**/*.tsx", "!**/dist", "!**/node_modules"]
  },
  "formatter": { "enabled": false },
  "assist": { "enabled": false },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": false,
      "suspicious": { "noExplicitAny": "error", "noImplicitAnyLet": "error" }
    }
  }
}
```

Add `"lint": "biome lint apps packages"` only when there is no existing lint
script. Preserve all existing typecheck/test/build/dev/start scripts. Reuse them,
for example `"check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"`
if those names already exist. Run them in CI as ordinary commands if desired;
no advisory Rin sensor or native hook is installed by this recipe.

For CD-3 merge these into your shared `compilerOptions` (do not replace the rest):

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "noPropertyAccessFromIndexSignature": true,
  "useUnknownInCatchVariables": true
}
```

Check **every** API, browser, shared-contract and build tsconfig using its own
installed compiler, e.g. `pnpm.cmd exec tsc --showConfig -p apps/api/tsconfig.json`.
All seven effective values must be true; review child configs for overrides.
Then run the existing typecheck. If enabling flags exposes unrelated debt, record
the findings and choose a bounded adoption; do not claim full CD-3 while weakening
flags or silently repair the whole repository. This recipe does not install Rin's
compiler-configuration auditor.

Not all CDs map to lint. For example `noParameterAssign` does not cover all CD-44
property/array mutation; `noStaticOnlyClass` does not ban all authored classes;
complexity limits do not prove orchestration-only bodies. Passing ordinary tests
also does not prove test isolation, boundary placement or all-discipline compliance.

## 4. Prove one failure and correction

In your isolated trial branch choose an unused file inside the selected scope.
For the example layout, verify `apps/api/src/rin-type-probe.ts` does not exist,
then create it containing exactly:

```typescript
export const rinTypeProbe: any = 'probe';
```

Run `pnpm.cmd lint`: expect nonzero exit and `lint/suspicious/noExplicitAny` at that
file. Correct the **same file** without suppressing the rule:

```typescript
export const rinTypeProbe: unknown = 'probe';
```

Run `pnpm.cmd lint` again: expect zero exit. Retain the diagnostic, corrected
contents, command, tool version and exits in your adoption artifact. Remove only
the probe you created, then run existing lint/typecheck/test/build commands.
A skipped/empty scan is not proof. Existing unrelated errors must be reported
separately; the deliberate probe's diagnostic must actually disappear.

This recipe was replayed in an ordinary isolated TS API + React clone of standalone
proof commit `ff1a829f4e911e181baf6f32789b88db76ab9914`. The original proof passed
30 tests, all three package builds/typechecks and lint; it resolved seven flags in
five configs. Replay on 2026-10-13 passed the literal three-file copy and pinned install command; lint checked 17 baseline files, the probe failed with exit 1, its unknown correction passed with exit 0, and final ordinary check passed all 30 tests and three package typechecks/builds. Independent docs/commands review found no blockers. The replay verifies the copy and ordinary red/green path, not a new
application, all-platform installation, automatic CD-46 or ESLint equivalence.

## 5. Make it usable in a fresh chat; update/remove safely

Commit the selected atomic files, source pin, applicability/coverage table,
configuration changes, initial inventory and command evidence. Add a small pointer
to your existing AGENTS.md or harness instructions (preserving their contents):

> Before editing, read docs/rin-disciplines/adoption.md and its selected atomic
> rules. Apply only the recorded selection and scope. Run the repository's ordinary
> checks. Report manual-review gaps and actual command results; never infer that
> reading rule prose enabled a checker.

Start a fresh chat with that same request and paths. This is artifact-based
instruction, not automatic skill discovery or workflow activation.

Update in a separate branch: compare old/new pinned rule text, review scope and
configuration, repeat the probe and ordinary checks. Manual copies have no sync
ownership hashes or automatic upgrades. Remove by reviewing and reverting only
this adoption's copied files, instruction pointer, dependency/lockfile changes and
selected config/script edits; preserve tools/rules used elsewhere. No core/plugin
uninstall command applies. Removing prose leaves tooling active until its actual
configuration is changed; removing tooling leaves prose as manual guidance.
