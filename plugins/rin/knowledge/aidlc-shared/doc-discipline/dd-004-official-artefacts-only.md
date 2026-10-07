---
id: DD-4
title: DD rules bind the official artefacts a gate produces, and nothing else
serves-principle: I
lens: [pr-claims]
pairs-with: [DD-1, DD-2, DD-3, DD-5]
amended: []
enforced-by:
  - population-rule
status: ratified
applies-to: gate-artefacts
portability: portable
aidlc-enforced-by:
  - population-rule
---

# DD-4 — DD rules bind the official artefacts a gate produces, and nothing else

The population every other DD rule applies to is the set of artefacts the gate stages **declare** they produce, resolved from the stage frontmatter `produces:` list for the stages the record's scope selects.

This rule is not itself a sensor. It is the population rule that decides what every DD sensor sees, and it is enforced by that scoping rather than by a check of its own.

## In the population

Every artefact named in a `produces:` entry of a stage the record's scope selects — the reconcile report, the requirements, the components, the interface lock, the code-generation plan, the disposition table, and their siblings.

## Out of the population, exhaustively

| excluded | why |
|---|---|
| `memory.md` | DD-5 makes this the append-only narration surface. A checker reading it would flag the discovery record the rule set exists to protect. |
| `aidlc-state.md`, `runtime-graph.json` | engine-generated; their stage numbers and identifiers are not authored claims |
| `audit/**` | hook-written gate proof; not authored prose |
| `.aidlc-*` scratch, evidence and sensor-detail directories | working files, not artefacts |
| anything not named by a `produces:` entry | not an official artefact |

## Closed conditions

- The population is read from the stage graph, never from a path glob written by hand. A hand-written glob drifts from the stages the moment a stage's `produces:` changes.
- An artefact absent from the population is **not** checked leniently — it is not checked at all, and no DD finding may be raised against it.

## Why

A document checker that reads the wrong files is worse than no checker. Its findings are noise, the noise trains the author to ignore the report, and the report then fails to carry the findings that were real. Scoping to declared artefacts is what keeps the signal rate high enough for an advisory sensor to be read rather than dismissed.
