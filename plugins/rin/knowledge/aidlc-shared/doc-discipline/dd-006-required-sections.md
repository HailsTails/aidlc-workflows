---
id: DD-6
title: A gate artefact carries the sections its stage requires
serves-principle: I
lens: [pr-claims]
pairs-with: [DD-4]
amended: []
enforced-by:
  - sensor:required-sections
status: ratified
applies-to: gate-artefacts
portability: portable
aidlc-enforced-by:
  - sensor:required-sections
---

# DD-6 — A gate artefact carries the sections its stage requires

An official gate artefact carries the section set its stage declares. Where no stage-specific set is declared, it carries at least two `##` headings.

## Closed conditions

- Where a template resolves for the artefact under `aidlc/spaces/<space>/memory/templates/<artifact>.md`, that template's `##` heading set is the required set and the artefact satisfies this rule iff the required set is a subset of the artefact's headings.
- Where no template resolves, the generic floor of two `##` headings applies.
- A heading present but empty satisfies nothing. The section carries content or it is missing.

## Provenance — this rule is adopted, not new

The mechanism already exists and already ships: the `required-sections` sensor, declared on every rin-gates stage that writes markdown. **DD-6 does not add a check.** It gives the existing check a rule id so the artefact-side rule set is complete and citable, exactly as the CD ids give the constitution walkers theirs.

Adopting it here means a reviewer can cite `DD-6` for a missing section the way they cite `CD-1` for an `any`, rather than referring to a sensor by name and hoping the reader knows what it enforces.

## Why

The section set is what makes an artefact comparable across records. A gate artefact missing its required sections is not merely untidy: the sections are the contract the next gate's `consumes:` reads, so an absent one is a downstream entry failure waiting to happen.
