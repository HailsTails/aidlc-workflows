---
id: DD-2
title: Prose references fact keys and states no figure of its own
serves-principle: I
lens: [pr-claims]
pairs-with: [DD-1, DD-3]
amended: []
enforced-by:
  - sensor:dd-2
status: ratified
applies-to: gate-artefacts
portability: portable
aidlc-enforced-by:
  - sensor:dd-2
---

# DD-2 — Prose references fact keys and states no figure of its own

Prose in an official gate artefact refers to a measured value by its fact key. It does not restate the value.

## The closed exemption list

A numeric literal in prose is a violation unless it is one of:

- an ISO date (`2026-09-06`)
- a record slug (`<YYMMDD>-<label>`)
- a pull-request reference (`#827`)
- a section reference (`§ 4`)
- a gate number (`Gate 3`)
- a four-digit year, or a one- or two-digit ordinal

Anything else belongs in a `facts.md` row and is referenced by key. **Nothing outside this list is exempt** — a figure that feels too small or too obvious to key is exactly the figure that later gets restated somewhere else and diverges.

Figures inside fenced code blocks and inside table rows are not prose and are out of scope.

## Closed conditions

- A figure appearing in both a fact row and a prose sentence is a violation of this rule, not a duplication of DD-1: the row is correct and the sentence must reference it.
- A figure quoted as the **subject** of an example — prose about a figure's own restatement — is exempt only where the artefact is documenting that defect. This exemption is not available for a figure being used as evidence.

## Why

A narrative paragraph is written to stand alone, so it re-establishes its own context — and re-establishing context is restating facts. That is how a single claim comes to occupy several sites without any author deciding to duplicate it, and it is why this rule is mechanical rather than a request for care.
