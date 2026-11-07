---
id: DD-3
title: Fact keys resolve across the record; restating a keyed fact is a duplicate
serves-principle: I
lens: [pr-claims]
pairs-with: [DD-1, DD-2, DD-4]
amended: []
enforced-by:
  - sensor:dd-1
status: ratified
applies-to: gate-artefacts
portability: portable
aidlc-enforced-by:
  - sensor:dd-1
---

# DD-3 — Fact keys resolve across the record; restating a keyed fact is a duplicate

Fact keys are scoped to the **intent record**, not to a single artefact. A later gate's prose references a fact defined by an earlier gate's artefact within the same record, and that reference resolves.

## Closed conditions

- A reference to a key defined anywhere in the record's official artefacts (DD-4) **resolves**. It is never a dangling reference on the grounds that the definition lives in another gate's artefact.
- A later gate that **restates** a fact already keyed by an earlier gate has produced a **duplicate**, not a new fact. The remedy is to reference the existing key.
- A fact defined in the record and referenced by no official artefact is an **orphan**. It is either missing from the argument or is not a fact; both are findings.
- Key uniqueness and numeric ordering are properties of the record, not of a file.

## Why

This is the rule that makes the fact set worth having across a whole pipeline run rather than one gate. Without it, Gate 3 restates Gate 1's measurements because it cannot reference them, and Gate 4 restates Gate 3's — which is the cross-gate half of the restatement this rule set exists to remove.

It is also what stops DD-1 from becoming per-artefact busywork: a gate does not re-measure and re-key what an earlier gate in the same record already established. It cites it.
