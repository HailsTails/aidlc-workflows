# Aggregate native review candidate

This branch is a review snapshot of the completed composed native source at `760ade07a4be3176a22c0d3857b6caac13fd52d3`, with upstream source pinned to `44a33053bdf9675276b4e502ff266c8acadc9172`. Its source tree is preserved exactly; this file is publication metadata.

The existing PR base is the fork's `d062c81e5678c9f92162542b425b8a5f095e46e1`. The aggregate therefore includes upstream rebaseline changes and existing Rin functionality as well as the responsibility refactor. It is not a clean upstream-only patch, a release candidate, or evidence of pristine upstream parity. The prior review snapshot remains in this branch's history.

## Included boundaries

The composition includes producer/runtime preparation owners, installed CLI boundaries, ordinary managed-file decisions, recorded retirement, ownership-record evolution, workspace seed authority, and JSON-map entry ownership. Existing native observation, compiler/runtime implementation, admission and guarded transaction machinery remain in use. The large installer and packager have not been wholly replaced.

The separate projection implementation is published in [draft PR 115](https://github.com/HailsTails/aidlc-workflows/pull/115), under `experiments/projection-replacement` at experiment source `28cca15c1ea44e8b02ce1d483292cf04006ddea3`.

## Verification and limits

- Fresh publication check: 98 pure managed-file and JSON-map policy tests passed with 101 assertions.
- The source owner qualified the JSON-map boundary with five actual CLI calls for both frozen reference and candidate. MCP bytes, ownership records, actions, protected user files and stale-plan behavior matched; return codes were `0/0/0/4/0`.
- That reference uses upstream-equal selected methods inside a retained composed runtime. It is not a pristine upstream distribution. The latest native pin has no fresh full producer or all-harness build.
- Earlier native `a731f3ea` received a complete-source Claude Core producer run; later boundaries used source-prepared module deltas over retained runtime fixtures.
- Existing full-source type-check failures and eight inherited whitespace warnings are not reclassified as passes. No full repository suite, host activation, deployment or merge qualification was performed for publication.
- The final JSON-map intent-receipt write was reported uncertain during a computer restart. The confirmed source commit and comparison results do not establish that receipt was persisted.

## Exclusions and next review

- Completed catalogue-refresh recovery extraction `675e6491718082b3a935f1519429c1f86d23aef7` remains unabsorbed.
- The JSON-map own-member/prototype-key correction is an unapplied forward patch in the projection snapshot. The native parity candidate deliberately preserves the original property semantics.
- Pristine upstream full-output/install parity and separation of Rin-only forward changes remain independent work.
- Private conversations, local execution logs, generated distributions, dependency folders and workstation-specific evidence are not added by this publication.

Publication advances only the existing review branch without rewriting its history. It does not change the main branch, open a new PR, merge, release or deploy.
