---
id: format
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-format.ts
default_severity: advisory
description: Applies the project formatter (biome) to a written file and reports whether it reformatted. Fires on every formatted code output.
category: code-quality
matches: "**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}"
input_schema:
  file_path: string
output_schema:
  pass: boolean
  reformatted: boolean
  file: string
  note: string
timeout_seconds: 20
---

# format sensor

Runs the configured formatter over the file that was just written.

## Why it applies rather than reports

Formatting has exactly one correct answer, so a finding is not useful information: the only action it permits is running the formatter, and the resulting diff never changes what the code means. Reporting it costs a round trip — author writes, gate rejects, author reformats, author pushes identical logic — and that loop repeats for every write. Applying the format at the moment of authorship removes the loop entirely, and leaves the push gate to fail on the things formatting cannot settle: lint findings and correctness errors.

This is why the sensor always passes. `reformatted: true` is a record of work done, not a violation to answer.

## Relationship to the shipped `linter` sensor

The framework's `linter` sensor prefers the consumer's `package.json` lint script. A Biome consumer can therefore run its own lint command without an ESLint configuration. Select the workspace root explicitly when that is where the script lives. This sensor covers formatting; the consumer lint script covers the lint rules the consumer configures. Older producer builds wrap ESLint only and may report an unavailable check instead of running Biome.

## Failure mode

If the formatter binary cannot be resolved the script exits 127 and the dispatcher reclassifies the fire as `tool-unavailable`, giving a quiet PASS rather than spamming script-error on a machine without the toolchain installed.
