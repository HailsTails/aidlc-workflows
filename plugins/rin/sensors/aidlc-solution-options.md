---
id: solution-options
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-solution-options.ts
default_severity: blocking
fire_on: gate
description: Holds Gate 2's options ledger to its minimum shape — each decision point has at least two candidates, each with a Premises line, exactly one Chosen candidate among them, and a reason for rejecting every other one and no other letter.
category: design-options
matches: "**/intents/**"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  sensor: string
  verdict: string
  findings_count: integer
  findings: object[]
  scanned: string
timeout_seconds: 10
---

# solution-options sensor

Runs at Gate 2 (`rin-gate-2-plan-review`) only. It reads the record's options ledger at `<record>/inception/rin-gate-2-plan-review/rin-solution-options.md`, a fixed path because the stage slug is stable by design.

## What it refuses

- The ledger is absent (when the sensor runs at all: see "When it runs"), or holds no `## Point: <name>` section.
- A point has fewer than two distinct `### Candidate <letter> — <name>` letters, or lists one letter twice. Whether a third candidate was needed is the board's judgement, not the sensor's.
- A candidate has no `- **Premises:**` line, or the line is neither a comma-separated list of `facts.md` keys (uppercase letters, a hyphen, then digits, e.g. `OT-1`) nor `none — <reason>`.
- A point has no `- **Chosen:** <letter>` line, or it does not name exactly one of the point's candidates.
- A candidate other than the chosen one has no `- **Rejected <letter>:** <reason>` line.
- A `- **Rejected <letter>:**` line names the chosen candidate, or a letter that is not one of the point's candidates.

Everything else about the ledger — whether the candidates are genuinely different, whether the comparison is complete, whether the choice follows from it, whether each cited premise key has its `facts.md` row (`unmeasured` when this entry introduced it, the status an earlier Gate 3 measured otherwise, and `withdrawn` only where a rejected candidate cites it) — is the review board's judgement.

## When it runs

The engine fires a gate sensor once for each of the gate's declared artefacts that exists. So this sensor reads the ledger whenever Gate 2 has written at least one of its artefacts. If only `rin-options-questions.md` exists, the absent ledger is refused. A Gate 2 that has written none of its artefacts dispatches no sensor, so this sensor cannot refuse it. That case is the board's: the ledger is the gate's review artefact, so the board has nothing to judge and cannot return READY. Gate 3 does not catch it, because Gate 3 consumes the ledger as optional.

## A ledger outside an intent record

`matches` also catches a path outside a record, that is, outside `aidlc/spaces/<space>/intents/<record>/`. The last such segment in the path names the record, so an earlier `intents` directory in a checkout's own path is not mistaken for one. Such a path belongs to no record, so there is no ledger to hold to shape; the sensor passes it and says so in `scanned` (`(not an intent record)`). Gate 2 only ever writes its ledger inside a record.

## Report

The sensor writes one JSON report. Its `verdict` is one of three values:

- `clean`: nothing to refuse.
- `refused`: the findings block approval.
- `unmeasured`: an input could not be read, the sensor ran at a gate other than its own, or it was invoked without `--stage` and `--output-path`. Each of the three causes carries its own remedy.

`pass` is true only for `clean`. Each finding carries `check`, `artefact`, `location` (either `{ kind: "line", lineNumber }` or `{ kind: "artefact" }`), `subject` and `remedy`.

## Blocking

Fires at the gate and blocks approval on any finding. A ledger it cannot read refuses as unmeasured rather than passing.
