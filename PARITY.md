# Build-side rebuild and output parity

This branch rebuilds the build side of AI-DLC by bounded context and proves that nothing it produces changes. It is measured against upstream `main` at `caea995ae`.

## What changed

- `scripts/package.ts` is now a short entry point into `src/`, which holds one folder per bounded context: `workflow-definition`, `projection`, `packaging`, `installation`, `execution` and `cli`, plus `kernel` for shared values and the platform implementers. `src/README.md` describes the layout and its rules.
- Each harness's build-side code moved into `src/hosts/<harness>/`: the `harness/<harness>/manifest.ts` rows, the Codex, Copilot and OpenCode emitters, the onboarding fills and the Kiro IDE delegate shell deny.
- `scripts/package-sources.ts`, `scripts/manifest-types.ts`, `scripts/harness-bindings.ts`, `scripts/onboarding.ts` and `scripts/earlier-release-regions.ts` moved into `src/` with their owners.
- Tests that imported the moved modules import them from `src/`. `src/` has its own unit tests, which touch no real files or processes.
- `zod` is a direct dev dependency, used at the file and JSON edges in `src/`. `bun run typecheck` also checks `src/tsconfig.json`.
- Nothing under `core/` or `plugins/` changes, and no shipped harness file changes: `hooks/`, `skills/`, `agents/`, `settings/`, `steering/`, `command/` and `plugin/` under `harness/<harness>/` are as they are on `caea995ae`.

## How parity is proved

Two sets of goldens, both recorded on an unmodified `caea995ae` checkout with the code in `scripts/parity/`:

- `tests/golden/<group>.json` holds the sha256 of every file under `dist/` and `dist-release/`, grouped by harness, with the plugin marketplace files under `plugin-marketplaces`. That is 5,982 files in 8 groups.
- `tests/golden/install/<harness>.json` holds an install lifecycle for each of the 7 harnesses, run through the copy-channel CLI in a throwaway project: a fresh install, a refresh, a local edit the installer refuses, a forced refresh, and an upgrade over the previous release (2.11.2). Each step records its exit code and the files it added, changed or removed.

Check this branch:

```sh
bun install
bun scripts/package.ts
bun scripts/parity/dist-goldens.ts --check
```

The install check also needs a dist built from the previous release, 2.11.2:

```sh
git worktree add ../aidlc-previous-release v2.11.2
bun install --cwd ../aidlc-previous-release
bun ../aidlc-previous-release/scripts/package.ts
bun scripts/parity/install-lifecycle.ts --check --previous ../aidlc-previous-release/dist
```

Each check prints a one-line summary and exits non-zero, naming every file that differs. `--record` writes the goldens instead. To reproduce them, copy `scripts/parity/` into a `caea995ae` checkout, build it, run `--record`, and compare the files with the ones here: they are byte-identical.

`scripts/parity/` is self-contained: it imports only Node and Bun built-ins and `zod`. `bun test ./scripts/parity` runs its unit tests.

The goldens are generated hash maps, so `.gitleaks.toml` allowlists `tests/golden/` by path, following the existing pattern from [#161](https://github.com/awslabs/aidlc-workflows/pull/161) and [#678](https://github.com/awslabs/aidlc-workflows/pull/678).

`bun test ./src` runs the unit tests of the new contexts.

## Open items

- Nothing in CI builds the previous-release dist yet, so the install check runs by hand.
- The coverage check `bun tests/gen-coverage-registry.ts --check --base <commit>` builds the base commit from `git archive` in a temporary folder with no `node_modules`. With `caea995ae` as the base it passes: `coverage registry: OK (guards green, no unit lost coverage against caea995ae)`. With a base that already contains `src/` (this tree as one commit on `caea995ae`) it exits 1: `COVERAGE BASE FAILED: building the base … stopped at bun scripts/package.ts claude`, followed by 45 identical `command-source-failed` refusals reading `Cannot find package 'zod' from '…/tree/src/cli/adapters/routes/projection/legacy-runner-child.ts'`. A change made on top of this one would meet the same failure.
- The upstream test runner's tiers and the CI workflows do not run `bun test ./src` yet.
- The install goldens record 2.11.3 over 2.11.2. The next upstream release needs them re-recorded from that release's commit.
- The rebuild has two phases. Phase 1 is this branch: the build side runs through `src/`, and every shipped byte stays as it is. Phase 2 moves the runtime owners out of `core/tools/` into `src/`, so they ship in the runtime bundle. That is runtime code, so it is a separate change, and it is what retires every bridge below.

## Foundation tests not on this branch

- The 62 test files of the lint and process layer that this branch leaves out: 61 under `lint/` (14 lint rules, 47 gate) and `eslint.config.test.ts`. Four gate test files moved with the parity code into `scripts/parity/`.
- `tests/unit/t-e2e-temporary-root.test.ts`: "an explicit root contains the descendant fixture and its cache" and "an unavailable explicit root refuses instead of choosing an OS fallback". They test a runner change to `tests/lib/e2e-workers.ts`, which this branch keeps as it is on `caea995ae`.
- `tests/unit/t-runner-production-guards.test.ts`: "an explicit temp boundary keeps the isolated fixture workspace Git-free", for the same runner change.
- `tests/unit/t-aidlc-lib-only-shrinks.test.ts`: "no monolith gains a top-level declaration or a line over its record", which used the lint layer's monolith records. The `caea995ae` case "aidlc-lib.ts declares no name that is not on its list" runs instead.
- `tests/integration/t-e2e-isolated-runner.test.ts`: "copied coverage refuses stale sources without changing its registry" and "copied coverage prints a source refusal before changing its registry" moved to `tests/unit/t-package-sources.test.ts` with the same assertions, on a fixture of their own. They test `tests/gen-coverage-registry.ts` against the moved `src/packaging/adapters/packaged-sources-file.ts`.

## Branch history

This branch is one commit on top of the rebuild's own history. The same tree as a single commit on `caea995ae`, for a pull request against upstream, comes from the `upstream-shape-tooling` branch of this fork:

```sh
bun src/regenerate.ts --repository <checkout> --parent caea995ae --branch upstream-shape-on-pin
```

Before that commit goes upstream, re-author it with the contributor's own identity and no `Co-Authored-By` trailer:

```sh
git log -1 --format=%B | grep -v '^Co-Authored-By:' | git commit --amend --reset-author --file=-
```

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
