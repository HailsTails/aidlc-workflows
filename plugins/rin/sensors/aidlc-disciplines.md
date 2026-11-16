---
id: disciplines
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-disciplines.ts
default_severity: advisory
description: Runs the repository's own Hone check (the npm package honed) when harness.config.json sets constitution.engine to hone, and reports the findings in the edited file. Under the default rin-walker engine it is not evaluated, and the cd-* sensors apply.
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

This sensor binds rin's per-edit constitution feedback to Hone
(https://github.com/HailsTails/hone, the npm package `honed`) in a repository
that adopted it. The earlier engine spelling `discipline-core` is still accepted. It reads `constitution.engine` from
`harness.config.json` in the checkout that holds the edited file.

- **`hone`.** The sensor runs the installed package's check,
  `node node_modules/honed/core/check/tool-command.js check --repo <checkout>`,
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

Emits `SENSOR_FAILED` with the edited file's findings. When Hone reaches no
verdict (not installed, exit 2, timed out), it fails and names the reason. A
vendored `tools/discipline-core/` copy still runs, but its pass is reported
unverified, and a package still installed under the old name `discipline-core`
is not run: the reason names the move to `honed`.
**Advisory**: the blocking half is the `rin-constitution-engine-gate.ts` hook,
which runs the same check before a stage `report --result approved|completed`
and exits 2 on a failing or unverified run.
