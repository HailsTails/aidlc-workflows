---
id: DD-1
title: Every measured claim is a keyed row carrying a re-derivation
serves-principle: I
lens: [pr-claims]
pairs-with: [DD-2, DD-3]
amended: []
enforced-by:
  - sensor:dd-1
status: ratified
applies-to: gate-artefacts
portability: portable
aidlc-enforced-by:
  - sensor:dd-1
---

# DD-1 — Every measured claim is a keyed row carrying a re-derivation

A measured claim in a record's official artefacts is a row in that record's `facts.md`. The row carries a key, the claim in words, the value, and the command or procedure that reproduces the value.

A claim is **measured** when its value came from counting, timing, querying, or reading a corpus. An assertion about what a thing *is* or *should be* is not a measured claim and takes no row.

## The row

| column | requirement |
|---|---|
| `key` | `<PREFIX>-<N>`. Unique within the record. Numerically ascending within its prefix. |
| `claim` | What is asserted. May reference another key to state its own population. |
| `value` | One value. A row carrying two independent numbers is two facts. |
| `re-derive` | The command, query, or procedure that reproduces the value. Not a description of one. |
| `status` | `live`, `corrected`, `withdrawn`, or `unmeasured`. |
| `corrected-by` | Empty when `live`. Otherwise what supersedes the row. |

## Closed conditions

- A claim whose value could not be obtained takes status `unmeasured` and states in `re-derive` how the measurement failed. **Omitting the row is a violation**: a failed measurement is a fact about the measurement, and dropping it reads as "not relevant" rather than "not known".
- A correction **replaces** the value in the existing row and fills `corrected-by`. It does not add a second row for the same claim, and it does not leave the prior value beside the new one.
- A derived value states its population by referencing the key it derives from, so a share cannot drift from the total it is a share of.

## Why

A claim stated in prose has no identity, so a reviewer refuting it can only quote text and the author can only fix the quoted instance. A claim with a key has exactly one site, so refuting it is a one-row edit and a comprehensive fix and a narrow fix become the same action.
