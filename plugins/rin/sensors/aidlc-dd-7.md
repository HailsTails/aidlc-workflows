---
id: dd-7
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-dd-7.ts
default_severity: advisory
description: Doc Discipline DD-7 — a section of an official gate artefact that defers work, places it out of scope, or records inherited debt or a carve-out carries its Five Whys chain beside the claim.
category: doc-discipline
enforces_dds: [DD-7]
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

# dd-7 sensor — an exception claim carries its chain

Reads every **official artefact** in the record (DD-4, resolved from the compiled stage graph's `produces:` entries) and reports any section making an exception claim with no Five Whys chain in it.

The sensor applies only when `harness.config.json` enables `rinGates.exceptionWhyChains`; otherwise it reports that DD-7 was not adopted.

## The unit is the section, not the line

A chain is several lines long and sits near its claim rather than on it, so a line-local check would flag every compliant artefact. Sections are split on markdown headings, with fenced blocks excluded; one chain serves every exception claim in its own section, which is DD-7's own closed condition.

## What counts as an exception claim

The deferral vocabulary R7 names: deferred, out of scope, inherited debt, carved out, grandfathered. **That list is a floor, not the test** — the same caveat the deferral rule in `project.md` carries about its own symptom list applies here for the same reason. A sixth phrasing this sensor does not match is exactly as defective, and the reviewer's judgement is what closes that gap; read as a banned-string list, this vocabulary invites rephrasing past it.

## It runs without `facts.md`

DD-1/DD-2/DD-3 are relations between prose and `facts.md` and cannot run without it. DD-7 reads the artefacts alone, so the shared inspector runs it whether or not the record keys facts. A record that has not reached a measuring gate is exactly where an unchained deferral is most likely, and hanging this rule off `facts.md` would have made it dark there — a check reporting a clean pass from an input it never read.

## Advisory

Reports only. A DD finding never refuses a write and never fails a gate.

**Advisory is the mechanism, not the rule's standing.** DD-7 is binding rule text, and R7 — the operating-mode rule it serves — is enforced by refusal on the registry and disposition surfaces. This sensor surfaces the artefact-side violation at write time with a pre-formed remedy, so the author fixes it before a reviewer has to raise it.
