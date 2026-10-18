---
id: linter
kind: deterministic
command: {{INVOKE}} engine sensor-linter
default_severity: advisory
description: Runs the project's package.json lint script when present, with a pinned ESLint fallback; fires on TS/JS code outputs
category: code-quality
matches: "**/*.{ts,js}"
input_schema:
  file_path: string
output_schema:
  pass: boolean
  violations:
    - file: string
      line: number
      rule: string
      message: string
timeout_seconds: 1200
---

# linter sensor

Runs `package.json`'s non-empty `scripts.lint` through the project's package
manager, in the nearest package directory above the written file. The script
runs exactly as authored: no file path, ESLint flags, formatter, or new rules
are appended. It may check the whole package or workspace; its exit status
owns the verdict. Choose a read-only lint script for advisory write checks.

The package manager comes from `--package-manager`, then the selected
manifest's `packageManager`, then its lockfile (`pnpm-lock.yaml`, `yarn.lock`,
`bun.lock`/`bun.lockb`, or `package-lock.json`), otherwise npm. Conflicting
lockfiles without an explicit manager refuse selection. npm, pnpm, Yarn and
Bun are supported; the manager and the consumer's lint dependencies must
already be available. The sensor does not install a manager or change config.

With no lint script, default `--runner auto` retains the existing pinned
ESLint path. `--runner project` requires the script: a missing manifest or
script exits 127 with `no-lint-script`, an unavailable check rather than a
verified lint pass. An empty or malformed script/manifest, or unsupported
manager, is a script error. `--runner eslint` explicitly selects the legacy
wrapper even when a lint script is present.

## Adoption and workspace directory

After installing a producer build containing this correction, an ordinary
package with `scripts.lint` needs no sensor override. For automatic sensor
fires in a monorepo, set these variables **in the process that launches the
harness**, selecting the directory containing the workspace lint script:

| Process environment | Direct invocation flag | Default |
| --- | --- | --- |
| `AIDLC_LINT_PROJECT_DIR` | `--project-dir <path>` | Nearest package directory |
| `AIDLC_LINT_PACKAGE_MANAGER` | `--package-manager npm\|pnpm\|yarn\|bun` | Manifest, lockfile, then npm |
| `AIDLC_LINT_RUNNER` | `--runner auto\|project\|eslint` | `auto` |

For example, a POSIX shell can launch the harness with
`AIDLC_LINT_PROJECT_DIR=. AIDLC_LINT_PACKAGE_MANAGER=pnpm AIDLC_LINT_RUNNER=project <your-harness-command>`.
In PowerShell, set the corresponding `$env:AIDLC_LINT_*` variables in the
launching process before starting the harness. No user-wide configuration is
required. `.` resolves from the sensor invocation's project cwd; an absolute
directory is also accepted. The written file is resolved before changing
subprocess cwd. Direct flags override process-scoped defaults.

The dispatcher currently reconstructs the worker argv from the sensor identity
and declared path contract; it does not forward suffix flags from `command:`.
Use process-scoped environment settings for automatic fires rather than
appending these flags to the manifest. Direct CLI use can pass the flags:

```text
aidlc engine sensor-linter --stage code-generation --file-path src/example.ts --runner project --project-dir . --package-manager pnpm
```

The existing sensor matches, stage binding and severity still determine when
it runs and whether findings block. Delegating the command does not configure
which CD rules ESLint or Biome enforces; maintain those in the consumer's own
lint config and its separate discipline sensors.

Echoes Fowler's "Eslint, Semgrep" examples from the harness-engineering article.

## Failure mode

Emits `SENSOR_FAILED` and writes detail to
`aidlc/spaces/<active-space>/intents/<active-intent>/.aidlc-engine/sensors/<stage-slug>/linter-<fire-id>.md`,
where the space and intent come from the active cursors. The fire id is the
8-hex correlator from the `SENSOR_FIRED` row in the active record's
`audit/<host>-<clone-id>.md` shard. The detail contains the linter's structured
output (file, line, rule, message per violation). In project-script mode,
nonzero exit becomes `pass: false` with one `lint-script-failed` finding and
bounded stdout/stderr diagnostics. Counts are a command-level failure signal,
not an invented count of lint violations; file/line detail is not parsed from
arbitrary tool text. A timeout, signal or spawn error becomes a failed
`lint-execution-incomplete` finding. Successful arbitrary stdout is accepted
without JSON parsing. The script writes only its sensor JSON to stdout.

Missing-script and selection errors retain the dispatcher's existing
unavailable/script-error classification; advisory audit rows may say
`SENSOR_PASSED` with that note even though lint was not evaluated. A blocking
gate requires a verified evaluation and refuses those unavailable outcomes.
This correction does not redesign the dispatcher event vocabulary.

## v0.6.0 carry-forward

Dedicated language detection remains separate. A consumer lint script can
already delegate to Biome, ESLint or a polyglot command without framework
language detection.
