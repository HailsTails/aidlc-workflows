---
id: cd-7
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-cd-7.ts
default_severity: advisory
description: Isolated enforcement for CD-7 — runs the constitution walker, filtered to CD-7 findings only. One sensor, one CD. Scope is harness.config constitution.include/exclude.
category: constitution
enforces_cds: [CD-7]
matches: "**/*.{ts,tsx}"
input_schema:
  file_path: string
  output_path: string
  project_dir: string
  stage_slug: string
output_schema:
  pass: boolean
  cd: string
  findings_count: integer
  findings: object[]
  scanned: string
timeout_seconds: 20
---

# cd-7 sensor — CD-7

Isolated per-CD enforcement for **CD-7** (No categorical filenames or folder names). Runs the vendored
`constitution` walker and filters its output to CD-7 findings only, so this
sensor enforces exactly one code-discipline rule and nothing else. The vendored
walker logic is reused byte-for-byte; the isolation is a filter at the sensor
boundary, and AIDLC joins the per-CD sensors via the stage graph's
`sensors_applicable` — there is no custom composition layer.

## Scope (config-driven)

Files are resolved by `aidlc-constitution-scope.ts` from the `constitution`
block of `harness.config.json` (`include`/`exclude` globs), falling back to a
portable default. Out-of-scope files pass with an `(out of scope)` note.

## Failure mode

Emits `SENSOR_FAILED` with a `findings[]` payload for CD-7 only. **Advisory** —
the blocking half is the `rin-constitution-gate.ts` hook that aggregates every
per-CD sensor and `exit(2)`s at stage completion.
