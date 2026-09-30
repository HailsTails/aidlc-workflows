---
id: dd-1
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-sensor-dd-1.ts
default_severity: advisory
description: Doc Discipline DD-1/DD-3 — fact-key referential integrity across the record's official artefacts. Every key defined once and in order, every reference resolves intent-wide, no orphans.
category: doc-discipline
enforces_dds: [DD-1, DD-3]
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

# dd-1 sensor — fact-key referential integrity

Reads the record's `facts.md` and every **official artefact** in that record — the `produces:` entries resolved from the compiled stage graph, per DD-4. Scratch files, `memory.md`, `aidlc-state.md`, evidence directories and audit shards are outside the population and are never read.

Reports four findings, each naming the exact next edit rather than describing the problem:

| finding | rule | remedy given |
|---|---|---|
| a key defined twice | DD-3 | delete the second row, correct the original in place |
| keys out of numeric order within a prefix | DD-1 | move or renumber the row |
| a reference with no row | DD-1 | add the row with its re-derive command, or fix the reference |
| a row referenced by no official artefact | DD-3 | reference it where used, or delete it |

## Keys resolve across gates, by design

Resolution is **record-wide**, not per-artefact (DD-3). A Gate-4 artefact referencing a fact Gate-1 keyed resolves cleanly, so a later gate cites an earlier gate's measurement rather than restating it. Orphan detection unions references across every official artefact before deciding a row is unused — checking each file independently would report a fact used by one artefact as orphaned by its sibling, which is a false positive that trains authors to ignore the report.

## Advisory

Reports only. A DD finding never refuses a write and never fails a gate.

**Advisory is the mechanism, not the rules' standing.** DD-1..DD-6 are binding rule text. This sensor surfaces a violation at write time with a pre-formed remedy, so the author fixes it before a reviewer has to raise it.
