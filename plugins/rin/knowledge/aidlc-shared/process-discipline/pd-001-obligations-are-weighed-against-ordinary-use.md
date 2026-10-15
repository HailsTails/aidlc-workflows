---
id: PD-1
title: An obligation is owed only if it traces to a requirement or guards a harm the customer's ordinary use can reach
serves-principle: I
lens: [clean-architecture, contract-constitution, ddd-modelling, decomposition, di-discipline, errors-as-data, function-first, intent-defense, naming, pr-checkers, pr-claims, pr-disposition, pr-evades, pr-scope, pr-tests-dead, test-discipline, type-soundness, zod-boundary]
pairs-with: [CD-37, DD-7]
amended: []
enforced-by:
  - judgement
status: ratified
applies-to: process
portability: portable
aidlc-enforced-by:
  - judgement
---

# PD-1 — An obligation is owed only if it traces to a requirement or guards a harm the customer's ordinary use can reach

An **obligation** is anything a seat makes owed: a requirement written at Gate 1, a lock clause as Gate 3 makes it, a code path, test, fixture, check or kept artefact a seat requests, or a finding whose remedy is one of those. Every obligation costs its whole life to carry. This rule decides which obligations are owed.

## Terms

- **The customer** is the consumers named in the `## Customer and ordinary use` section of the record's requirements artefact. When that section is absent or names no customer, the customer is the operator.
- **Ordinary use** is the uses that section names. When the section is absent, names no customer or names no uses, ordinary use is the inputs and conditions the record's requirements name.
- **A core requirement** is a requirement in the record's requirements artefact, cited by its id.
- **A known limit** is a harm that only input or conditions outside ordinary use can reach. It owes no code, test, fixture or check, whether it would fail loudly or silently. The record may state it as a known limit.
- **A cheaper handling** of another rule's claim on some code is removing that code.

## Closed conditions

1. An obligation is owed only if it traces by id to a core requirement, or it guards against a harm the customer's ordinary use can reach. An obligation meeting neither is not owed.
2. This rule applies the same way to an obligation claimed at any gate from Gate 1 to Gate 5.
3. A clause already locked at Gate 3 is not waived by this rule. It binds under "locked is scope" and moves only by lock-level ceremony. This rule weighs a lock clause when Gate 3 makes it.
4. Another discipline's rule, or a seat's own prompt, binds code that exists. It is never on its own a reason for code to exist, and a cheaper handling ends its claim. This includes a seat prompt's own harm threshold. A rule's demand on code that is owed, such as a test that rule requires for an owed file, is owed with that code.
5. This rule governs additions only. It never makes owed the removal of existing code or of an existing check, and never makes not owed a change to existing code that another rule requires.
6. A finding whose only demand is an obligation this rule does not owe is non-blocking. The lens that raises it records it disposed, in the shape its agent file states. At a gate that requires every finding to carry a disposition, declining it is a push-back grounded in `PD-1`, carrying the Five Whys chain the project's exception rule requires.
