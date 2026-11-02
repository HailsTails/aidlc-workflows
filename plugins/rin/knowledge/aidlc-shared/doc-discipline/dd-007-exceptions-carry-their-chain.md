---
id: DD-7
title: An artefact claiming an exception carries its Five Whys chain beside the claim
serves-principle: I
lens: [pr-claims, intent-defense]
pairs-with: [DD-1, DD-5]
amended: []
enforced-by:
  - sensor:dd-7
status: ratified
applies-to: gate-artefacts
portability: project
aidlc-enforced-by:
  - sensor:dd-7
---

# DD-7 — An artefact claiming an exception carries its Five Whys chain beside the claim

A sentence in an official artefact that defers work, places work out of scope, classifies something inherited debt, or records a carve-out is an **exception claim**. It carries its Five Whys chain in the same artefact, adjacent to the claim.

The chain's shape is discipline-core's why-chain contract (`plugins/discipline-core/docs/why-chain-contract.md` in this fork, `tools/discipline-core/docs/why-chain-contract.md` in a repository that installed core), which R7 adopts. Write the chain to that contract, and review it against the checks it lists and the judgements it leaves to review. DD-7 governs only *where* the chain lives — beside the claim, in the artefact that makes it — and is the artefact-side surface of the same obligation the registries and the disposition table enforce on their own surfaces. No tool reads an artefact's chain against the contract yet ([#76](https://github.com/HailsTails/aidlc-workflows/issues/76)), so in an artefact the contract's checks are the reviewer's to apply.

## Closed conditions

- An exception claim whose chain lives only in a capture, a commit message, or a review comment is a violation. The artefact is what the next gate reads.
- A chain stated once serves every claim in its own section. A second claim in the same section referencing the first chain is not a duplicate.
- A claim naming a record or capture id **and** carrying the chain there is satisfied only when the chain is also present in this artefact; the id is provenance, not a substitute (§ DD-1's re-derivation requirement takes the same shape).

## Portability

Marked `project` rather than `portable`: the rule depends on R7, which is a rin operating-mode rule. It applies only when the project enables `rinGates.exceptionWhyChains` in `harness.config.json`.

## Why the chain belongs in the artefact

An exception recorded without its cause reads identically to one that was reasoned through. A later gate re-reading the artefact cannot tell them apart, so it inherits the exception as settled — and the cheapest way to make an unexamined deferral look examined is to state it confidently in prose. Putting the chain beside the claim makes the two distinguishable at the only moment anyone is positioned to challenge it.
