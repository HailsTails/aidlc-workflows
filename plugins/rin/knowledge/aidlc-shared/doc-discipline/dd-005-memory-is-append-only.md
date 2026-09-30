---
id: DD-5
title: Discovery narration lives in memory, append-only; artefacts carry no history
serves-principle: I
lens: [pr-claims, intent-defense]
pairs-with: [DD-1, DD-4]
amended: []
enforced-by:
  - judgement
status: ratified
applies-to: gate-artefacts
portability: portable
aidlc-enforced-by:
  - judgement
---

# DD-5 — Discovery narration lives in memory, append-only; artefacts carry no history

How a conclusion was reached — what was tried, what was withdrawn, which instrument was wrong — belongs in the stage's `memory.md`. The official artefact states what is true now.

## Closed conditions

- A correction to an artefact **replaces** the claim. It does not append a note beside the claim, and it does not add a section describing the correction.
- `memory.md` is **append-only**. An entry is added with its timestamp; a superseded entry is not edited or deleted, because the superseding is the record.
- An artefact section whose subject is the artefact's own change history is a violation. A heading that corrects an earlier heading of the same artefact is the clearest instance.
- A withdrawn claim leaves the artefact entirely. Its fact row takes status `withdrawn` (DD-1) and the reasoning moves to `memory.md`.

## Why this rule is judgement and not a sensor

Nothing available to a script distinguishes narration from reasoning. Both are prose; both may reference the past. A rule that tried to detect "this paragraph is history" mechanically would either miss the real cases or flag legitimate reasoning about prior work, and a checker that flags legitimate content is the failure mode DD-4 exists to avoid.

It stays with the review board, and it is written down so the rule set is complete rather than only its checkable parts.

## Why the split matters

An artefact carrying its own change history **forces** additive correction: deleting a claim would erase the record of having held it, so the author appends beside it instead. The reviewer then cites one site, the fix closes one site, and the next round finds a sibling. Giving history its own home is what turns a correction into a replacement — and replacement is what makes a fix comprehensive rather than narrow.
