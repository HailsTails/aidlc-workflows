---
id: measured-contracts
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-measured-contracts.ts
default_severity: blocking
fire_on: gate
description: Blocks Gate-3 approval of an interface lock whose chosen candidates rest on a premise that is not listed under External reality or whose facts.md status is not live or corrected. It reads the status word only; whether the measurement was made is the board's judgement.
category: design-options
matches: "**/rin-interface-lock.md"
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

# measured-contracts sensor

Runs at Gate 3 (`rin-gate-3-interface-lock`) only, on `rin-interface-lock.md`. It reads the lock, the record's `facts.md`, and the Gate-2 options ledger at its fixed path `<record>/inception/rin-gate-2-plan-review/rin-solution-options.md`.

## What it refuses

For each premise key on the `Premises` line of each point's chosen candidate:

- the key has no entry `- <key> — …` under the lock's `## External reality` section;
- the key has no `facts.md` row, or any of its rows has a status other than exactly `live` or `corrected`.

An absent `facts.md` has no rows, so each chosen premise key it is asked about is refused as having no row; a chosen candidate whose Premises line is `none — <reason>` asks about no key.

It also refuses a present ledger it cannot read premises from: a ledger with no `## Point:` section, and a point whose Chosen line does not resolve to exactly one of its candidates, or whose chosen candidate has no readable Premises line.

## A record with no options ledger

A record that passed Gate 2 before Gate 2 wrote an options ledger has no chosen-premise list. The sensor passes it and says so in its `scanned` line. Which premises such a design rests on is the review board's judgement, as is every other external fact the lock relies on.

## A lock outside an intent record

`matches` also catches a `rin-interface-lock.md` outside a record, that is, outside `aidlc/spaces/<space>/intents/<record>/`. The last such segment in the path names the record, so an earlier `intents` directory in a checkout's own path is not mistaken for one. Such a file belongs to no record, so there is no ledger or `facts.md` to measure against; the sensor passes it and says so in `scanned` (`(not an intent record)`). Gate 3 only ever writes its lock inside a record.

## What it leaves to the board

The sensor reads only the status word of each `facts.md` row, and the ledger and `facts.md` it reads are files Gate 3 itself can edit. So a status set to `live` without its probe, a claim rewritten, or a chosen candidate's Premises line changed all pass it. The completeness lens judges six things this sensor does not check:

- contract element states (`specified` or `escalated`);
- that every external fact a contract names is listed under `## External reality`;
- that every listed key which is not a chosen premise, and every premise of a record with no options ledger, has a `facts.md` row with status `live` or `corrected`;
- whether a chosen premise whose status is `corrected` still supports its point's choice;
- that every `live` or `corrected` chosen-premise row carries a measured value produced by its re-derivation, not only the status word;
- that the ledger's chosen Premises lines, and the claim column of every chosen premise's `facts.md` row, are unchanged since Gate 2's approval. The lens diffs both files against the commit Gate 2 approved.

## Report

The sensor writes one JSON report. Its `verdict` is one of three values:

- `clean`: nothing to refuse.
- `refused`: the findings block approval.
- `unmeasured`: an input could not be read, the sensor ran at a gate other than its own, or it was invoked without `--stage` and `--output-path`. Each of the three causes carries its own remedy.

`pass` is true only for `clean`. Each finding carries `check`, `artefact`, `location` (either `{ kind: "line", lineNumber }` or `{ kind: "artefact" }`), `subject` and `remedy`.

## Blocking

Fires at the gate and blocks approval on any finding. A lock, ledger or `facts.md` it cannot read refuses as unmeasured rather than passing.
