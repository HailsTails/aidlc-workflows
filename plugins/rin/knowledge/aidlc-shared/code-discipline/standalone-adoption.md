# Standalone code disciplines: TS API + React quick start

Trial selected Rin code disciplines using generated artifacts and your normal lint,
typecheck and test commands. This is a **manual copy recipe**, not a plugin-selector
mode. The Rin plugin declares a dependency on AIDLC core; its full installer is
[documented separately](https://github.com/HailsTails/aidlc-workflows/blob/main/docs/guide/rin-fork-installation.md).
The basic knowledge-copy recipe installs no AIDLC stages, scopes, hooks, Rin gates,
private services, MCP servers or workflow runtime. The optional direct-tool recipe
below copies an entire generated tools tree, including inert files outside the CD
walkers; it does not register or run those files. Copying prose does not activate
enforcement.

The layers are separate: copied knowledge requires an explicit agent read;
consumer lint/type checks enforce only when invoked; automatic edit-triggered
sensor feedback requires installed hooks and proven dispatch. This copy-only path
installs no live sensors or hooks. The full AIDLC/Rin installation is separate;
its automatic feedback must not be inferred from an ordinary command result.

## 1. Build and copy selected harness projections

Prerequisites: Git and Bun for the source packager; an existing TS API + React
repo with its own working package-manager and check scripts. Run this Bash example
from outside the consumer repo, choosing your own new source directory and existing
consumer directory. Paths may contain spaces; the trial branch name must be unused. The example targets Cursor; the
source pin is a public fork revision, not an upstream release badge.

```bash
(
  set -e
  read -r -p 'New source checkout directory: ' source_checkout
  read -r -p 'Existing consumer repository directory: ' consumer
  consumer=$(cd "$consumer" && pwd)
  git clone https://github.com/HailsTails/aidlc-workflows.git "$source_checkout"
  git -C "$source_checkout" checkout --detach 3e90a545b081a4633060bec86c9379252e10b43c
  source_checkout=$(cd "$source_checkout" && pwd)
  cd "$source_checkout"
  bun install --frozen-lockfile
  projection="$source_checkout/dist/plugins/rin/cursor"
  bun scripts/package.ts plugin build rin cursor "$projection"
  cd "$consumer"
  git switch -c adopt-selected-rin-disciplines
  destination='.cursor/knowledge/aidlc-shared/code-discipline'
  mkdir -p "$destination"
  cp -i "$projection/knowledge/aidlc-shared/code-discipline/cd-001-no-any.md" \
    "$projection/knowledge/aidlc-shared/code-discipline/cd-003-strict-mode-flags.md" \
    "$projection/knowledge/aidlc-shared/code-discipline/cd-046-decarve-on-touch.md" "$destination/"
)
```

The subshell stops on failure and leaves your original shell directory unchanged.
Run the later consumer commands from your consumer repository. `cp -i` asks before
replacement; decline unless you have reviewed the existing file. The basic path
copies only selected knowledge files, not stages, hooks, scopes or tools. The
optional direct-tool path is below.
Replace the three filenames in the cp command inside the subshell with your chosen canonical files after reading the inventory. The projection/destination variables are local to that subshell. To copy all atomic artifacts for an explicit review library, the existing shell operation is `cp -i "$projection/knowledge/aidlc-shared/code-discipline"/cd-*.md "$destination/"`; the three collapsed IDs are redirects to their owners, not extra active rules. Also copy `standalone-adoption.md`, `standalone-linter-options.md` and `standalone-cd-inventory.md` from that generated directory if you want these guides beside the library. This does not select checks or activate native discovery.

For Codex or Claude, build `codex` or `claude` instead and use `.codex/knowledge/aidlc-shared/code-discipline`
or `.claude/knowledge/aidlc-shared/code-discipline` as the destination. This uses the existing harness
projection/token substitution; it adds no installer, format or runtime.

**Native discovery gap:** Rin CDs currently project under
`knowledge/aidlc-shared/code-discipline/`, not Cursor's native `.cursor/rules/*.mdc`
location. Copying these files does not automatically load them as Cursor rules.
The same copy is not an automatic Codex `AGENTS.md` or Claude `CLAUDE.md` instruction.
Harness-native selected-CD projection is a gap to backlog; this recipe is a
bounded packaging/copy trial, not a completed rules-only installer. The existing
full installer brings the runtime and is not required or presented as rules-only.

Until that gap is addressed, explicitly ask a fresh chat to read the selected
files from the destination above before editing. That is a manual instruction,
not loading proof. Do not rename a `.md` to `.mdc` and claim activation. Cursor's
[official rules documentation](https://cursor.com/docs/rules) requires native
metadata; referenced files are read on demand, not inlined into model context.
The repository's existing Cursor adapter records the same boundary.

Bash is the main example for Linux/macOS/WSL. Windows users can use Git Bash;
PowerShell users may adapt Git/copy syntax. Tested platforms are stated below;
macOS execution is not claimed. Record the source commit with the copied files.

## 2. Choose coverage before enabling checks

Use the [complete 45-CD inventory](standalone-cd-inventory.md) to choose additional knowledge/review obligations and tested partial checks. It separates execution evidence from semantic suitability, rejects non-equivalent defaults, and includes progressive strict-flag adoption, manual gaps and existing Rin tool limitations. All active CDs can be selected without AIDLC stages; selecting prose alone enables no check.


Read the selected files in full and record scope in your existing project instructions or an adoption record beside the copied files:

| Selection | Deterministic coverage in this recipe | Review responsibility / gaps |
| --- | --- | --- |
| CD-1 | Biome 2.4.16 `noExplicitAny` and `noImplicitAnyLet`, errors on configured TS/TSX files | Not proof against all semantic propagation of `any`; CD-1 permits no carve-outs |
| CD-3 | Existing TypeScript compilation with seven flags below | Review effective inheritance and future config edits; ordinary compilation does not prevent weakening flags |
| CD-46, optional | Manual in the basic path; optional direct decay CLI below | Whole touched exempt file must comply with its exempted rule and retire its exemption in the same change; never exempt CD-46 itself |

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

Use the consumer's existing linter first. The [tested ESLint and oxlint alternatives](standalone-linter-options.md) cover the same bounded explicit-any trial, including parser setup, source/test probes and remaining compiler/manual obligations. Do not install a second linter merely because an atomic rule names Biome.

Preserve the agreed source and test population. Never exclude tests, weaken rules or shrink configured coverage to get green checks. Report existing findings, assess deliberate pre-existing exclusions, and resolve scope explicitly before changing them; do not claim an ignored probe passed. Initial inventory requires no Five Whys, but CD-1 permits no exemptions. This is not permission for blanket baselines or unrelated legacy remediation.

AIDLC/Rin source tools use Bun, as the package command above does. Consumer
lint/type/test tools remain consumer-owned: keep the existing package manager,
lockfile, installed versions and script names. Bun is not imposed on the consumer.

For a new **Bun-managed consumer** with no linter, the minimal example is:

```bash
bun add --dev --exact @biomejs/biome@2.4.16 --ignore-scripts
```

For an existing npm/pnpm/Yarn consumer, use that manager's equivalent pinned dev
install instead. Do not run Bun's dependency installation in that consumer merely
to follow this example or replace its lockfile. The earlier pnpm replay was an
existing consumer example, not AIDLC's installer/tooling requirement.
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
for a Bun consumer, for example `"check": "bun run lint && bun run typecheck && bun run test && bun run build"`
if those names already exist. Run them in CI as ordinary commands if desired;
no advisory Rin sensor or native hook is installed by this recipe.

Reuse the same existing validation command in the agent's instructions, the
existing CI validation step and existing Lefthook pre-push `run` entry. For example,
if your project already validates with `pnpm check`, retain that exact command in
all three places; a Bun-managed consumer may already use `bun run check`. Preserve
other CI jobs and hook commands. Do not install Lefthook or create duplicate CI
just for this trial. No actual Lefthook invocation is claimed by this guide.

Tell the agent: “Read the selected discipline files before editing. Before handoff,
run this repository's existing validation command, report its exit and findings,
and review the recorded manual obligations.” Invoked lint/type checks are the
deterministic backstop; manually reading prose is guidance. CI and pre-push checks
run at their existing triggers, not continuously after every edit. Optional
AIDLC sensor feedback is not required for this standalone validation path.

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
installed compiler, e.g. `bun run tsc --showConfig -p apps/api/tsconfig.json` in a Bun consumer.
All seven effective values must be true; review child configs for overrides.
Review explicit strict-family overrides as well: strict:true does not undo a child noImplicitAny:false or strictNullChecks:false. Then run the existing typecheck. For a progressive path that keeps required checks and exposes pending diagnostics without pretending advisory findings cannot grow, see the [inventory](standalone-cd-inventory.md#initial-debt-and-progressive-cd-3-adoption). If enabling flags exposes unrelated debt, record
the findings and choose a bounded adoption; do not claim full CD-3 while weakening
flags or silently repair the whole repository. This recipe does not install Rin's
compiler-configuration auditor.

Not all CDs map to lint. For example `noParameterAssign` does not cover all CD-44
property/array mutation; `noStaticOnlyClass` does not ban all authored classes;
complexity limits do not prove orchestration-only bodies. Passing ordinary tests
also does not prove test isolation, boundary placement or all-discipline compliance.

### Optional: run the existing Rin inventory tools directly

Choose this only if you want Rin's **fixed aggregate CD walker**, carve-out decay
check and hermetic-test guard alongside your consumer-owned lint/type/test tools.
The aggregate walker cannot select individual CD IDs and is not an all-CD or CD-1
checker. It can surface findings for disciplines outside your selected reading
set. Inventory those findings before making this a required check. There is no
supported slim CD-tools package yet: the existing TypeScript walker imports a
sensor-named helper, so manually pruning the generated tree is not a supported
install. This is a manual full-tools copy, not the full Rin/AIDLC install. It
does not register stages, hooks, scopes or sensors, and it does not run the other
copied gate/sensor files. Bun is needed to invoke these tools; the consumer keeps
its own package manager and scripts.

After completing step 1, run this Bash block from outside the consumer repo.
Enter the **same pinned** producer checkout and an existing consumer checkout.
It stops if a tools directory already exists; compare and plan ownership before
replacing an existing installation. The example targets Cursor; for another
harness, use its matching projection and destination directory.

```bash
(
  set -e
  read -r -p 'Pinned source checkout directory: ' source_checkout
  read -r -p 'Existing consumer repository directory: ' consumer
  source_checkout=$(cd "$source_checkout" && pwd)
  consumer=$(cd "$consumer" && pwd)
  test "$(git -C "$source_checkout" rev-parse HEAD)" = '3e90a545b081a4633060bec86c9379252e10b43c'
  projection="$source_checkout/dist/plugins/rin/cursor"
  test -f "$projection/tools/rin-harness-constitution-audit.ts"
  test -f "$projection/tools/rin-harness-sensor-cd-extras.ts"
  test ! -e "$consumer/.cursor/tools"
  test ! -L "$consumer/.cursor/tools"
  mkdir -p "$consumer/.cursor"
  cp -R "$projection/tools" "$consumer/.cursor/tools"
)
```

To scan the intended paths in this example monorepo, add a consumer-owned
`harness.config.json` at the repo root. The CLIs also run without one, but fall
back to a narrower default scope. Review an existing config rather than
replacing it. For the example workspace,
adapt this valid skeleton to the **actual** API, browser, shared and test paths:

```json
{
  "projectName": "example-api-and-react",
  "defaultScope": "standalone-cd",
  "rulesetRoot": ".cursor/knowledge/aidlc-shared",
  "stageGraph": "not-installed-in-standalone-trial",
  "packageManager": { "primary": "pnpm", "runnerAllowlist": ["pnpm"] },
  "constitution": {
    "include": ["apps/api/src/**", "apps/web/src/**", "packages/shared/src/**", "scripts/**"],
    "exclude": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.git/**", "**/.cursor/**"],
    "scriptGlobs": ["scripts/**"]
  },
  "rinGates": { "exceptionWhyChains": false }
}
```

`stageGraph` is a required config field, not an installed stage in this direct
tool trial. Change `packageManager` and paths to match the consumer. Keep test
files in the included paths. The walker's `scriptGlobs` treatment relaxes most
non-script CD checks under `scripts/**`; keep consumer lint and manual review for
that population, and do not count it as full aggregate coverage. Run
`bun .cursor/tools/rin-harness-config.ts print`
and inspect the resolved scope: a missing/malformed config can fall back to a
narrow root/default scan. In the synthetic API + React trial, that default scan
found one root TS file while the explicit config scanned 16. A zero-findings
result from an empty or wrong scan is not adoption evidence.

From the consumer root, run its **existing** lint command and the direct tools
sequentially. This local trial uses `HEAD` only while changes are uncommitted:

```bash
pnpm lint && \
bun .cursor/tools/rin-harness-constitution-audit.ts --project-dir . && \
bun .cursor/tools/rin-harness-carve-out-decay.ts --project-dir . --base-ref HEAD && \
bun .cursor/tools/rin-harness-hermetic-git-guard.ts --project-dir . --minimum-test-files 1
```

Use the consumer's real package-manager command in place of `pnpm lint`. If a
repo has no hermetic-test population yet, omit the optional floor and record that
the guard's default floor is **zero**; a pass with zero scanned tests does not
establish test coverage. For committed branch changes or CI, use the fetched,
resolvable PR base, such as `--base-ref origin/main`, instead of `HEAD`; otherwise
the decay check can miss already-committed touches. Append these three `bun`
commands with `&&` to the consumer's existing `lint:ci`/validation chain (or its
equivalent CI step), after its existing lint/type/test commands as appropriate.
Preserve its existing lint engine, scripts and failure status. The CLI exit codes
are the gate here; copying tools or prose alone runs nothing. The aggregate audit
and decay checks return nonzero on findings; the hermetic guard returns nonzero on
findings or a chosen positive floor failure.

For inherited aggregate findings, add only reviewed, rule-specific initial-debt
records under `.constitution-carve-outs/cd-<id>.json`. Each file is a JSON array,
for example:

```json
[
  {
    "files": ["apps/api/src/legacy-handler.ts"],
    "reason": "Inherited finding recorded during standalone adoption",
    "decision": "Initial adoption inventory accepted by API owner on YYYY-MM-DD; retire on touch"
  }
]
```

Replace the owner/date example with the actual reviewer and decision provenance.
Initial adoption debt does **not** require Five Whys. The example config keeps
the optional exception-why-chain gate off. Do not carve out CD-1 or CD-46, and
do not put an unrelated file in an exemption just to turn the audit green.
`.constitution-authorised-locations/cd-<id>.json` is a separate structural
authorization mechanism, not an initial-debt shortcut. CD-46's direct decay
check fails if an exempt file is touched; correct the **whole file** against its
recorded rule and remove that file from the sidecar in the same change. Review
the aggregate findings manually: neither a clean walker nor a carve-out proves
every selected discipline. Update/remove copied tools only after comparing
source revisions, consumer config and sidecar ownership; there is no selective
installer ownership or automatic upgrade/removal for this copy path.

## 4. Prove one failure and correction

In your isolated trial branch choose an unused file inside the selected scope.
For the example layout, verify `apps/api/src/rin-type-probe.ts` does not exist,
then create it containing exactly:

```typescript
export const rinTypeProbe: any = 'probe';
```

Run your lint script (`bun run lint` in a Bun consumer): expect nonzero exit and the selected linter's explicit-any diagnostic at that
file. Biome reports `lint/suspicious/noExplicitAny`; ESLint reports
`@typescript-eslint/no-explicit-any`; oxlint reports `typescript(no-explicit-any)`.
Correct the **same file** without suppressing the rule:

```typescript
export const rinTypeProbe: unknown = 'probe';
```

Run the same lint script again: expect zero exit. Retain the diagnostic, corrected
contents, command, tool version and exits in your adoption artifact. Remove only
the probe you created, then run existing lint/typecheck/test/build commands.
Repeat the same red/green probe in an unused `.test.ts` file within the agreed test population. See the alternative recipes for engine-specific diagnostic names. A skipped/empty or ignored scan is not proof. Existing unrelated errors must be reported
separately; the deliberate probe's diagnostic must actually disappear.

Verification is deliberately bounded. The original TS API + React trial used
Windows, Node 22.22.2, pnpm 10.33.2, TypeScript 6.0.3 and Biome 2.4.16. Its ordinary
pnpm red/green probe passed, then 30 tests and three package typechecks/builds
passed. All seven flags resolved true in five configs. That was consumer-tool
proof, not an AIDLC installation or native rule-loading proof.

The corrected packaging/copy commands were executed in Git Bash 5.3.9 on Windows
with Bun 1.3.14, using an ordinary isolated consumer clone and a chosen source
path containing spaces. The pinned producer installed frozen dependencies,
projected Rin with the existing package command, and copied the three generated
files into the consumer harness directory. Copied bytes matched the projection. Ordinary consumer lint, three typechecks/builds and all 30 tests also passed through Bun's script runner while preserving the existing pnpm-owned scripts and lockfile. An invalid consumer path stopped the copy block before writes.
A separate new Bun-managed fixture verified the exact Bun dependency command and
`bun run lint` failure/correction/success with the displayed Biome configuration.
Its `.test.ts` probe also failed with explicit `any` and passed with `unknown`.
Linux/macOS/WSL portability is based on Bash syntax and existing tooling, not an
execution claim for those platforms. No native automatic loading, live sensor
feedback or all-discipline enforcement was proved by that basic copy trial.

The optional direct-tool trial used the exact producer revision
`3e90a545b081a4633060bec86c9379252e10b43c` and a separate ordinary
synthetic TS API + React clone on Windows. The existing packager generated the
Cursor Rin projection; copying its entire `tools/` tree supplied the aggregate
walker's imported helper. An explicit config scanned 16 existing TS files and
initially reported 19 inherited findings. Seven reviewed, rule-specific debt
sidecars made the initial inventory pass without Five Whys. A deliberate CD-15
`for...of` violation failed the aggregate audit; correcting it made the same
audit pass. Touching a carved CD-44 file failed the CD-46 decay check; paying
down that whole file and removing its sidecar made it pass. The hermetic guard
scanned eight test files. The aggregate walker did **not** detect a deliberate
explicit `any`; the consumer's existing Biome lint failed on it, then passed
after `unknown` replaced it. Finally, the consumer's existing `pnpm check`
passed lint, three package typechecks/builds and 31 tests. This proves direct
CLI behavior in that fixture, not a slim tools install, native rule loading or
complete discipline enforcement.

## 5. Fresh-chat use; update/remove safely

Commit the copied projected files, source pin, explicit scope/coverage, initial
inventory and command evidence. Until native projection exists, explicitly ask a
fresh chat to read those files and the adoption record before editing. Confirm it
can name the chosen IDs and scope; this is manually prompted use, not automatic
native loading. The rule text does not activate a linter or compiler check.

Update on a separate branch: build from the new pinned producer, compare selected
projected files and any optional full tools tree, review configuration/scope and
sidecars, then repeat the probes and ordinary checks. These copies have no
installer ownership hashes or automatic upgrades. Remove only this trial's
copies and chosen config/script/dependency edits after review; preserve tools
or rules used elsewhere and the consumer's lockfile history.
No core/plugin uninstall command applies to these copies. Native rule projection
and a true rules-only install/update/removal selection remain backlog gaps.

## 6. Moving to discipline-core

A repository that adopts discipline-core (`disciplines.json`,
`discipline-exceptions.json`, `tools/discipline-core/`) replaces this route.
Follow `tools/discipline-core/MIGRATING.md`. If the repository also runs the
Rin AIDLC plugin, it keeps `harness.config.json` and must flip the engine in the
same change. Otherwise Rin's stage gate, per-CD sensors and review lenses keep
using the walker and the records described above, and they disagree with CI:

```json
{
  "constitution": {
    "engine": "discipline-core",
    "baseRevision": "origin/main"
  }
}
```

- `engine` is `"rin-walker"` (the default when absent) or `"discipline-core"`.
  Any other value fails the stage gate rather than silently choosing one.
- `baseRevision` is passed to core as `--base-revision`. Set it whenever
  `discipline-exceptions.json` holds a file carve-out or an entry imported with
  `provenance`; otherwise core reports `forfeiture-unmeasured` or
  `import-unmeasured` and fails. Use a ref every worktree can resolve, such as
  `origin/main`, not a local `main` that may lag.
- Each `.constitution-carve-outs/cd-<id>.json` entry moves to
  `discipline-exceptions.json` as a `file-carve-out` with
  `{ "kind": "inherited-debt", "source", "decision" }` provenance, and each
  `.constitution-authorised-locations/cd-<id>.json` entry moves as an
  `authorised-location` with `{ "kind": "existing-authorisation", "source" }`.
  MIGRATING step 3 gives the exact shapes.
- `constitution.include`, `exclude`, `scriptGlobs` and `uiGlobs` no longer set
  the scope under discipline-core: `disciplines.json` and its `exclude` do.

With the engine flipped, the stage gate runs
`node tools/discipline-core/core/check/check-command.ts --repo <checkout>` from
the checkout that holds the command's working directory, with that checkout's
own packages. Exit 0 passes. Exit 1 ending in `verdict: fail` refuses the stage
and lists the failing sections. Anything else refuses it as unverified. The
`disciplines` sensor reports core's findings in each edited file, the `cd-*`
and `carve-out-decay` sensors report themselves not evaluated, and the review
lenses read core's rule pages (see `aidlc-shared/lenses/ruleset-source.md`).
