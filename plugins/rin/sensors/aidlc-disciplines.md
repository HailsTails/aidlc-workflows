---
id: disciplines
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-disciplines.ts
default_severity: advisory
description: Runs the repository's own discipline-core check when harness.config.json sets constitution.engine to discipline-core, and reports the findings in the edited file. Under the default rin-walker engine it is not evaluated, and the cd-* sensors apply.
category: constitution
matches: "**/*.{ts,tsx,mts,cts}"
input_schema:
  file_path: string
  output_path: string
  project_dir: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  findings: object[]
  scanned: string
timeout_seconds: 180
---

# disciplines sensor

This sensor binds rin's per-edit constitution feedback to discipline-core in a
repository that adopted it. It reads `constitution.engine` from
`harness.config.json` in the checkout that holds the edited file.

- **`discipline-core`.** The sensor runs
  `node tools/discipline-core/core/check/check-command.ts --repo <checkout>`,
  adding `--base-revision` when `constitution.baseRevision` is set. It runs in
  that checkout with its own packages. It reports the `findings` lines whose
  file is the edited file. Selection, scope and exceptions come from
  `disciplines.json` and `discipline-exceptions.json`, exactly as in CI. The
  per-CD `cd-*` sensors and `carve-out-decay` report themselves not evaluated.
- **`rin-walker`** (the default). The sensor passes with a not-evaluated note,
  and the `cd-*` sensors run rin's built-in walker.

## Cost

Core has no per-file mode, so each run checks the whole repository (ESLint
included) and then keeps one file's findings. That is about 15 to 18 seconds
per TypeScript write on a mid-sized repository.

## Failure mode

Emits `SENSOR_FAILED` with the edited file's findings. When core reaches no
verdict (not installed, exit 2, timed out), it fails and names the reason.
**Advisory**: the blocking half is the `rin-constitution-engine-gate.ts` hook,
which runs the same check before a stage `report --result approved|completed`
and exits 2 on a failing or unverified run.
