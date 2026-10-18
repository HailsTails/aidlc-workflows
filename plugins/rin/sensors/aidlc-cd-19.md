---
id: cd-19
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-cd-19.ts
default_severity: advisory
description: Isolated enforcement for CD-19 — runs the constitution walker, filtered to CD-19 findings only. One sensor, one CD. Scope is harness.config constitution.include/exclude.
category: constitution
enforces_cds: [CD-19]
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

# cd-19 sensor — CD-19

Isolated partial check for **CD-19** (external dependencies confined to wrapping
ports). The source walker reports CD-19's listed third-party imports and CD-20's
explicit `node:` imports; CD-20 is a redirect into CD-19, not a separate active
rule. The sensor selects both finding prefixes and AIDLC joins per-CD sensors
through the stage graph's `sensors_applicable`.

The Node check handles literal specifiers in imports, re-exports, `require`,
dynamic imports and import-type queries. Bare Node names need an ESLint
`n/prefer-node-protocol` rule in the consumer's own lint command. The vendor
check covers only its exact static `from` list. Neither check proves approved
wrapping-port ownership; see the standalone CD inventory for setup and gaps.

## Scope (config-driven)

Files are resolved by `rin-harness-constitution-scope.ts` from the `constitution`
block of `harness.config.json` (`include`/`exclude` globs), falling back to a
portable default covering root, `src/`, `scripts/`, `test/` and `tests/` TS/TSX.
Out-of-scope files pass with an `(out of scope)` note.

## Failure mode

Emits `SENSOR_FAILED` with a `findings[]` payload for CD-19 only. **Advisory** —
the blocking half is the `rin-constitution-gate.ts` hook that aggregates every
per-CD sensor and `exit(2)`s at stage completion.
