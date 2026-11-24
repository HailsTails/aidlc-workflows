# Build-side rebuild and output parity

This branch rebuilds the build side of AI-DLC by bounded context and proves that nothing it produces changes. The adopted rebaseline is measured against exact upstream `d5a4aaecbda47283705314bf1ceb908271cef80b` (not a moving main).

## What changed

- `scripts/package.ts` is now a short entry point into `src/`, which holds one folder per bounded context: `workflow-definition`, `projection`, `packaging`, `installation`, `execution` and `cli`, plus `kernel` for shared values and the platform implementers. `src/README.md` describes the layout and its rules.
- Each harness's build-side code moved into `src/hosts/<harness>/`: the `harness/<harness>/manifest.ts` rows, the Codex, Copilot and OpenCode emitters, the onboarding fills and the Kiro IDE delegate shell deny.
- `scripts/package-sources.ts`, `scripts/manifest-types.ts`, `scripts/harness-bindings.ts`, `scripts/onboarding.ts` and `scripts/earlier-release-regions.ts` moved into `src/` with their owners.
- Tests that imported the moved modules import them from `src/`. `src/` has its own unit tests, which touch no real files or processes.
- `zod` is a direct dev dependency, used at the file and JSON edges in `src/`. `bun run typecheck` also checks `src/tsconfig.json`.
- The coverage check `bun tests/gen-coverage-registry.ts --check --base <commit>` runs `bun install --frozen-lockfile` in the base commit's `git archive` tree before building it, as CI does in the checkout and `scripts/copy-era-files.ts` does in its archived release. A base that already contains `src/` needs `zod` to build, so without it a change made on top of this one fails the check with 45 `Cannot find package 'zod'` refusals.
- Phase 1 preserves every installed byte relative to the adopted upstream pin, including code. The rebaseline retains upstream changes under `core/`, `plugins/` and `harness/`; its build-side requirements are folded into the canonical owners in `src/`. It does not freeze those inputs at the earlier pin.

## How parity is proved

Two independent sets of goldens now bind exact public upstream `d5a4aaecbda47283705314bf1ceb908271cef80b`, tree `bea698830819db0afb5fb5913406fab0dd19604d`. Its stock build ran on native Linux with official Bun 1.4.4; every public copy-runtime archive entry was rehashed after transport. The unchanged parity lab recorded the seven expected lifecycles from that public artifact on Windows, using independently verified v2.11.3 bytes for upgrades. Candidate observations were recorded separately and compared as complete records. No expected value was generated from the candidate:

- `tests/golden/<group>.json` holds the sha256 of every file under `dist/` and `dist-release/`, grouped by harness, with the plugin marketplace files under `plugin-marketplaces`. That is 5,998 files in 8 groups.
- `tests/golden/install/<harness>.json` holds an install lifecycle for each of the 7 harnesses, run through the copy-channel CLI in a throwaway project: a fresh install, a refresh, the host-specific response to a local edit, a forced refresh, and an upgrade over the previous release (2.11.3). Each step records its exit code and the files it added, changed or removed.

Check this branch:

```sh
bun install
bun scripts/package.ts
bun scripts/parity/dist-goldens.ts --check
```

The install check also needs a dist built from the previous release, 2.11.3:

```sh
git worktree add ../aidlc-previous-release v2.11.3
bun install --cwd ../aidlc-previous-release
bun ../aidlc-previous-release/scripts/package.ts
bun scripts/parity/install-lifecycle.ts --check --previous ../aidlc-previous-release/dist
```

Each check prints a one-line summary and exits non-zero, naming every file that differs. `--record` writes the goldens instead; use it only on the independently built pinned public producer during a deliberate rebaseline, never to accept candidate drift. The 2026-11-24 receipt retains the exact reference and candidate maps, independent archive identities, all seven complete record pairs and raw terminal logs. The sole excluded raw output is non-installed `dist/.package-sources.json`, whose source fingerprint necessarily differs between implementations.

`scripts/parity/` is self-contained: it imports only Node and Bun built-ins and `zod`. `bun test ./scripts/parity` runs its unit tests.

The goldens are generated hash maps, so `.gitleaks.toml` allowlists `tests/golden/` by path, following the existing pattern from [#161](https://github.com/awslabs/aidlc-workflows/pull/161) and [#678](https://github.com/awslabs/aidlc-workflows/pull/678).

`bun test ./src` runs the unit tests of the new contexts.

## Open items

- Nothing in CI builds the previous-release dist yet, so the install check runs by hand.
- The upstream test runner's tiers and the CI workflows do not run `bun test ./src` yet.
- The install goldens record 2.11.4 over 2.11.3. The next upstream release needs them re-recorded from that release's commit.
- The rebuild has two phases. Phase 1 is this branch: the build side runs through `src/`, and every shipped byte stays as it is. Phase 2 moves the runtime owners out of `core/tools/` into `src/`, so they ship in the runtime bundle. That is runtime code, so it is a separate change, and it is what retires every bridge below.

## Original-pin test cases re-expressed for the new owners

The following inventory describes the earlier `8c4f79b4b` migration; it is retained as history, not a current whole-suite qualification. The 2026-11-24 requirement ledger maps all 67 commits through `d5a4aaec` and the separately attributable OpenCode, Kiro knowledge and hook-activation successor ports. A plausible partial OpenCode port returned success while leaving two repository-only imports; retained adverse tests and corrected installed-byte equality cover that missing requirement.

Every test file `8c4f79b4b` has is on this branch, and none has fewer cases. The `upstream-shape-tooling` branch counts them with `bun src/test-case-counts.ts`. Where a case tested a file that moved into `src/`, it runs here in upstream's runner against the new owner. `src/`'s own unit tests do not count toward this, because upstream's runner does not run them.

- `tests/unit/t-package-sources.test.ts`: every case in the `8c4f79b4b` file tested `scripts/package-sources.ts`, which moved to `src/packaging/adapters/packaged-sources-file.ts`. They run against the moved owner with upstream's assertions.
  - The fingerprint input list replaces `harness/claude/manifest.ts` with a harness file and `src/hosts/claude/host-data.ts`, the manifest's successor.
  - The ignore case also checks a `src/` test file.
  - A record whose sources changed during the build answers `inputs-changed`, where upstream returned `false`.
  - The stale-dist coverage case runs as the two copied-coverage cases below.
- `tests/integration/t145-packaging-parity.test.ts`: three cases built a renamed or synthetic harness by editing `harness/<name>/manifest.ts`. A host now declares every path in its own `src/hosts/<name>/` files, so the fixture renames the host's directory throughout that folder, and for the synthetic harness its name and `harness/<name>/` sources too.
  - "a synthetic harness passes harnessDir to tools" runs in place of "a synthetic harness uses the default orchestrator path and passes harnessDir to tools". It builds the Claude host as `foo` in `.foo`, keeping Claude's tier flavor as upstream's copied manifest did, and makes upstream's assertions. One part of the original cannot apply:
    - **The default orchestrator path.** The path is no longer an optional field. Each host's comes from its skills root, which `t303` checks.
  - "a codex host honors a renamed harnessDir" makes upstream's assertions on the hooks, rules, trust seed and runner. The Codex settings renderer names its own adapter, so the hook commands name the adapter `codex`, not `foo`, and the host keeps the name `codex`.
  - "write mode derives the graph when a harnessDir is renamed" makes upstream's assertions.
  - The nondeterministic-emitter case runs as "--check reports the path built nondeterministically", on a host settings renderer.
- `tests/unit/t285-knowledge-skill.test.ts`: "the codex/copilot hardcoded skill array names the skill (the N-of-N trap)" read the skill arrays in the Codex and Copilot `emit.ts`. Both are retired, and every host now renders session skills from one list, `SESSION_SKILL_NAMES` in `src/projection/domain/neutral-surface.ts`. The case runs for each of the seven hosts: the host's skill renderer renders session skills, and the list names `aidlc-knowledge`.
- `tests/unit/t303-packager-orchestrator-skill-path.test.ts`: "package.ts resolves the optional manifest field with the in-tree default" read `scripts/package.ts`. It runs as "each host's skill renderer places the orchestrator skill in-tree at its declared path".
  - The case checks that each host's renderer writes `skills/aidlc/SKILL.md` at the path the test matrix declares, through `projectPath`.
  - Neither the renderers nor `scripts/package.ts` joins a project root with `.agents` or `.github` skills.
  - The in-tree default for an omitted field cannot apply, because the field is no longer optional.

## Foundation tests not on this branch

- The 62 test files of the lint and process layer that this branch leaves out: 61 under `lint/` (14 lint rules, 47 gate) and `eslint.config.test.ts`. Four gate test files moved with the parity code into `scripts/parity/`.
- `tests/unit/t-e2e-temporary-root.test.ts`: "an explicit root contains the descendant fixture and its cache" and "an unavailable explicit root refuses instead of choosing an OS fallback". They test a runner change to `tests/lib/e2e-workers.ts`, which this branch keeps as it is on `8c4f79b4b`.
- `tests/unit/t-runner-production-guards.test.ts`: "an explicit temp boundary keeps the isolated fixture workspace Git-free", for the same runner change.
- `tests/unit/t-aidlc-lib-only-shrinks.test.ts`: "no monolith gains a top-level declaration or a line over its record", which used the lint layer's monolith records. The `8c4f79b4b` case "aidlc-lib.ts declares no name that is not on its list" runs instead.
- `tests/integration/t-e2e-isolated-runner.test.ts`: "copied coverage refuses stale sources without changing its registry" and "copied coverage prints a source refusal before changing its registry" moved to `tests/unit/t-package-sources.test.ts` with the same assertions, on a fixture of their own. They test `tests/gen-coverage-registry.ts` against the moved `src/packaging/adapters/packaged-sources-file.ts`.

## Original branch history

The following regeneration recipe is historical. Local `rebuild/base` and `rebuild/foundation` now identify the adopted pinned baseline and its received implementation; the dated successor Phase 1 tag preserves the earlier 2026-11-18 seal. No public branch or fork main is advanced by this local adoption, and the runtime gate remains closed.

This branch is one commit on top of the rebuild's own history. The same tree as a single commit on `8c4f79b4b`, for a pull request against upstream, comes from the `upstream-shape-tooling` branch of this fork:

```sh
bun src/regenerate.ts --repository <checkout> --pin 8c4f79b4b --parent 8c4f79b4b --branch upstream-shape-on-pin
```

The regenerated commit is authored and committed by `HailsTails <9475175+HailsTails@users.noreply.github.com>`, set in the tooling and never read from git config, with no `Co-Authored-By` trailer, so it needs no re-authoring before it goes upstream.

## Bridge map

Where the rebuilt build side still couples to the runtime, and what retires each coupling. The same data is in `src/bridge-map.json`. The map is descriptive: nothing on this branch enforces the context arrows, the bridges or `src/glossary.json`.

Context arrows:

- `kernel` depends on nothing
- `workflow-definition` depends on `kernel`
- `projection` depends on `kernel`, `workflow-definition`
- `packaging` depends on `kernel`, `projection`
- `installation` depends on `kernel`, `packaging`; reads the file formats of `packaging`
- `execution` depends on `kernel`, `workflow-definition`
- `cli` depends on `kernel`, `workflow-definition`, `projection`, `packaging`, `installation`, `execution`

| Legacy owner | Read by | Reads | Retires when |
|---|---|---|---|
| `core/tools/aidlc-lib.ts` | `src/projection/domain/host-surface.ts` | types | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-runtime-paths.ts` | `src/projection/domain/host-surface.ts` | types | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-tiers.ts` | `src/projection/domain/tier-flavor.ts` | types | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-model-policy.ts` | `src/projection/adapters/legacy-agent-surfaces.ts` | runtime | Phase 2 model-policy cutover: its owner moves into src and ships in the runtime bundle, deleting agentTiersFromAuthoredDirectory, the unreachable authored-agents walk the phase 1 freeze keeps in shipped bytes. |
| `core/tools/aidlc-model-policy.ts` | `src/hosts/codex/projection/toml-models.ts` | runtime | Phase 2 model-policy cutover: Codex's agent TOML model rewrite moves into src with the policy owner. |
| `core/tools/aidlc-tiers.ts` | `src/projection/adapters/legacy-tiers.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-runner-gen.ts` | `src/cli/legacy-runner-child.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-utility.ts` | `src/projection/adapters/legacy-skill-tables.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-settings.ts` | `src/projection/adapters/legacy-settings-schema.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-command.ts` | `src/projection/adapters/legacy-trusted-commands.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-runtime-budget.ts` | `src/projection/adapters/legacy-runtime-budget.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-launcher-voucher.ts` | `src/hosts/copilot/projection/launcher.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-includes.ts` | `src/projection/adapters/legacy-includes.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-inline-context.ts` | `src/projection/adapters/legacy-format-docs.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-inline-context.ts` | `src/hosts/kiro/projection/knowledge-reading.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-inline-context.ts` | `src/hosts/kiro-ide/projection/knowledge-reading.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-plugin-emit.ts` | `src/projection/adapters/legacy-plugin-emit.ts` | runtime | Phase 2 plugin-tools cutover: its owner moves into src and ships in the runtime bundle, deleting the pluginReviewerAgents stage-file regex fallback that the shipped plugin build and plugin test still reach. |
| `core/tools/aidlc.ts` | `src/projection/adapters/legacy-dispatcher.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/hooks/aidlc-state-transition-guard.ts` | `src/projection/adapters/legacy-delegate-admission.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-lib.ts` | `src/projection/adapters/legacy-workspace-commands.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-distribution.ts` | `src/packaging/adapters/legacy-distribution.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-version.ts` | `src/packaging/adapters/legacy-version.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-channel.ts` | `src/packaging/adapters/legacy-channel.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |
| `core/tools/aidlc-archive.ts` | `src/packaging/adapters/legacy-archive.ts` | runtime | Phase 2: its owner moves into src and ships in the runtime bundle. |

Legacy files each context takes over when its owner moves into `src/`:

- `workflow-definition`: `core/tools/aidlc-stage-schema.ts`, `core/tools/aidlc-rule-schema.ts`, `core/tools/aidlc-sensor-schema.ts`, `core/tools/aidlc-graph.ts`, `core/tools/aidlc-artifact-vocabulary.ts`, `core/tools/aidlc-plugin-rules.ts`, `core/tools/aidlc-plugin-produces-kinds.ts`, `core/tools/aidlc-plugin-validate.ts`
- `projection`: `scripts/package.ts`, `scripts/package-sources.ts`, `core/tools/aidlc-tiers.ts`, `core/tools/aidlc-runner-gen.ts`, `core/tools/aidlc-plugin-emit.ts`, `core/tools/aidlc-plugin-build.ts`
- `packaging`: `scripts/package-release.ts`, `scripts/build-binaries.ts`, `scripts/verify-release.ts`, `scripts/copy-era-files.ts`, `core/tools/aidlc-channel.ts`, `core/tools/aidlc-version.ts`, `core/tools/aidlc-release.ts`
- `installation`: `core/tools/aidlc-update.ts`, `core/tools/aidlc-lifecycle.ts`, `core/tools/aidlc-distribution.ts`, `core/tools/aidlc-transaction.ts`, `core/tools/aidlc-uninstall-plan.ts`, `core/tools/aidlc-install-paths.ts`, `core/tools/aidlc-runtime-paths.ts`, `core/tools/aidlc-gitignore.ts`, `core/tools/aidlc-settings.ts`, `core/tools/aidlc-windows-uninstall.ts`, `core/tools/aidlc-machine-config.ts`, `core/tools/aidlc-native-launcher.ts`, `core/tools/aidlc-executable-path.ts`
- `execution`: `core/tools/aidlc-state.ts`, `core/tools/aidlc-record-core.ts`, `core/tools/aidlc-audit.ts`, `core/tools/aidlc-review-brief.ts`, `core/tools/aidlc-review-manifest.ts`, `core/tools/aidlc-review-records.ts`, `core/tools/aidlc-construction-checkpoints.ts`, `core/tools/aidlc-guard-fences.ts`, `core/tools/aidlc-guard-operation.ts`, `core/tools/aidlc-guard-switch.ts`, `core/tools/aidlc-unit.ts`, `core/tools/aidlc-unit-dag.ts`, `core/tools/aidlc-unit-holders.ts`, `core/tools/aidlc-unit-landing.ts`, `core/tools/aidlc-unit-walk-view.ts`, `core/tools/aidlc-swarm.ts`, `core/tools/aidlc-swarm-checkpoints.ts`, `core/tools/aidlc-swarm-source.ts`, `core/tools/aidlc-directive.ts`, `core/tools/aidlc-questions.ts`, `core/tools/aidlc-question-store.ts`, `core/tools/aidlc-plan-approval-ask.ts`, `core/tools/aidlc-jump.ts`, `core/tools/aidlc-attest.ts`, `core/tools/aidlc-learnings.ts`, `core/tools/aidlc-stage-diary.ts`, `core/tools/aidlc-locks.ts`, `core/tools/aidlc-message-store.ts`, `core/tools/aidlc-reply-reader.ts`, `core/tools/aidlc-recorded-switches.ts`, `core/tools/aidlc-validity.ts`, `core/tools/aidlc-brought-files.ts`, `core/tools/aidlc-sensor.ts`, `core/tools/aidlc-sensor-record.ts`, `core/tools/aidlc-bolt.ts`
- `cli`: `core/tools/aidlc.ts`, `core/tools/aidlc-utility.ts`, `core/tools/aidlc-command.ts`, `core/tools/aidlc-completions.ts`, `core/tools/aidlc-hook-front-gate.ts`, `core/tools/aidlc-hook-trace.ts`, `core/hooks/**`
