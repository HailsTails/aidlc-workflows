---
id: dd-2
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-dd-2.ts
default_severity: advisory
description: Doc Discipline DD-2 — prose in an official gate artefact references fact keys and states no figure of its own, beyond the closed exemption list.
category: doc-discipline
enforces_dds: [DD-2]
matches: "**/intents/**"
input_schema:
  output_path: string
  project_dir: string
  stage_slug: string
output_schema:
  pass: boolean
  dd: string
  findings_count: integer
  findings: object[]
  scanned: string
timeout_seconds: 10
---

# dd-2 sensor — no bare figures in prose

Reads every **official artefact** in the record (DD-4, resolved from the compiled stage graph's `produces:` entries) and reports any numeric literal in prose that is not a fact-key reference.

## The closed exemption list

Scrubbed structurally before tokenising, so the allowlist stays small rather than growing to cover every shape:

- ISO dates, record slugs, pull-request references, section references, gate numbers
- four-digit years; one- and two-digit ordinals
- anything inside a fenced code block or a table row

Everything else is a finding, and the remedy is always the same shape: *move it into a `facts.md` row and reference that key here instead*, with the file, line and offending token.

## Why the allowlist is small and the scrubbing is structural

A large allowlist is quiet and lets real figures through. Scrubbing the shapes that are legitimately literal — a date is a date, a slug is a slug — keeps the allowlist to two patterns while handling the common cases. That split was arrived at the hard way: a first cut tokenised before scrubbing, split record slugs at the hyphen, and would have flagged every record reference in every artefact.

## Advisory

Reports only. A DD finding never refuses a write and never fails a gate.

**Advisory is the mechanism, not the rules' standing.** DD-1..DD-7 are binding rule text. This sensor surfaces a violation at write time with a pre-formed remedy, so the author fixes it before a reviewer has to raise it.
