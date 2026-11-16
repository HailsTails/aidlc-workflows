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

`bun test ./src` runs the unit tests of the new contexts.

## Open items

- Nothing in CI builds the previous-release dist yet, so the install check runs by hand.
- The coverage check `bun tests/gen-coverage-registry.ts --check --base <commit>` builds the base commit from `git archive` in a temporary folder with no `node_modules`. With `caea995ae` as the base it passes: `coverage registry: OK (guards green, no unit lost coverage against caea995ae)`. With a base that already contains `src/` (this tree as one commit on `caea995ae`) it exits 1: `COVERAGE BASE FAILED: building the base … stopped at bun scripts/package.ts claude`, followed by 45 identical `command-source-failed` refusals reading `Cannot find package 'zod' from '…/tree/src/cli/adapters/routes/projection/legacy-runner-child.ts'`. A change made on top of this one would meet the same failure.
- The upstream test runner's tiers and the CI workflows do not run `bun test ./src` yet.
- The install goldens record 2.11.3 over 2.11.2. The next upstream release needs them re-recorded from that release's commit.
- The rebuild has two phases. Phase 1 is this branch: the build side runs through `src/`, and every shipped byte stays as it is. Phase 2 moves the runtime owners out of `core/tools/` into `src/`, so they ship in the runtime bundle. That is runtime code, so it is a separate change, and it is what retires every bridge below.

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

{{bridge-map}}
