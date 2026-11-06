# Projection replacement review snapshot

This source-only snapshot comes from experiment `28cca15c1ea44e8b02ce1d483292cf04006ddea3`. The matching completed native source is `760ade07a4be3176a22c0d3857b6caac13fd52d3`, published separately in [draft PR 114](https://github.com/HailsTails/aidlc-workflows/pull/114).

The snapshot makes the aggregate projection design reviewable: source observation, pure policy and rendering, runtime preparation, owned product composition, and publication have separate owners. The public complete-source Claude Core producer reconstructs its qualified output without prebuilt distribution inputs while reusing existing AIDLC compiler/runtime implementations. Installation still runs through native planning and guarded transactions; the experiment is not a wholesale replacement of that runtime.

## Contents

- `src/domain`: prepared documents, native resources, authored products, workflow compilation and installation models.
- `src/application`, `src/adapters` and `src/infrastructure`: validated boundaries, source readers, harness emitters, process and storage ports.
- `examples`, `__tests__` and `scripts`: runnable compositions, behavioral tests and maintained test fixtures.
- `native-extraction`: source-boundary patches with different historical bases. These are inspection artifacts, not a sequence to apply blindly. The current integrated native tree is in PR 114.
- `tools/discipline-core`: the maintained checker; its existing license is retained.

The JSON-map ownership extraction has a pure decision owner and explicit fresh-map result consumed by the real installer. Its broader own-member/prototype-key correction is retained only as `native-extraction/deferred-json-map-own-members.patch`, an unapplied forward change. It is not part of the matching native parity candidate.

## Run source checks

Requires Bun 1.3.14 and Node 22.18 or newer. In an independent checkout, install dependencies with `npm ci --ignore-scripts` and `npm install --ignore-scripts --prefix tools/discipline-core`, then run `npm run typecheck`, `npm test`, `npm run demo`, `npm run disciplines` and `npm run lint`.

No dependencies were installed for publication. The source owner's original `npm run check` passed at this experiment pin with 1,921 tests and 3,263 assertions, including its retained evidence checks. This published snapshot intentionally excludes the local verification archive, so the original aggregate evidence command is not reproducible here and is not claimed to pass. The script remains unchanged.

## Fresh publication checks

This exact source snapshot passed strict TypeScript, 1,921 tests across 200 files with 3,263 assertions, the runnable demo, the selected discipline checks and ESLint. Existing dependencies were reused. These source checks do not include the excluded private evidence archive or substitute for full native producer/install qualification.
## Qualification limits

The current native source combines upstream rebaseline changes and existing Rin work. These branches are aggregate fork review snapshots, not a clean upstream-only refactor or release candidate. Frozen JSON-map reference/candidate runs matched five actual CLI scenarios, but the reference was an upstream-equal method in a retained composed runtime, not a pristine upstream distribution. The latest native source has no fresh complete-producer or all-harness build.

Pristine upstream output/install parity, the unabsorbed catalogue-refresh recovery extraction `675e6491718082b3a935f1519429c1f86d23aef7`, and separation of Rin-only forward changes remain distinct work. The final JSON-map intent-receipt write was reported uncertain at restart; confirmed source and comparison results do not establish that receipt was persisted.

Private conversations, workstation paths, raw execution logs, generated output, dependencies and the local evidence archive are excluded. No live host activation, merge, release or deployment is authorized or performed by publishing this snapshot. The prior snapshot remains in the branch history.
