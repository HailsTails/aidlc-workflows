---
id: type-check
kind: deterministic
command: {{INVOKE}} engine sensor-type-check
default_severity: advisory
description: Wraps the project's configured type-checker (tsc by default for v0.5.0); fires on TS/TSX code outputs
category: code-quality
matches: "**/*.{ts,tsx}"
input_schema:
  file_path: string
output_schema:
  pass: boolean
  errors:
    - file: string
      line: number
      column: number
      message: string
timeout_seconds: 1200
---

# type-check sensor

Wraps the project's configured type-checker. v0.5.0 defaults to tsc;
multi-language auto-detection (mypy, go vet, cargo-check) is deferred
to v0.6.0+.

`tsc` is the one the project itself installed, resolved from the nearest
`node_modules/typescript` at or above the `tsconfig.json` directory, never from
`PATH` and never downloaded. When TypeScript is not installed the sensor exits
127 with `tsc-unavailable` and a message naming what to install, recorded as
an unavailable check rather than a verified pass. Install `typescript` as a
devDependency of the repository to enable it.

Echoes Fowler's "type checkers" example from the harness-engineering article.

## Failure mode

Emits `SENSOR_FAILED` and writes detail to
`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/type-check-<fire-id>.md`,
where the space and intent come from the active cursors. The fire id is the
8-hex correlator from the `SENSOR_FIRED` row in the active record's
`audit/<host>-<clone-id>.md` shard. The detail contains the type-checker's
structured output.

## v0.6.0 carry-forward

Multi-language detection at framework boundary (read project type from
practices `## Tech Stack` section, dispatch appropriate type-checker).
