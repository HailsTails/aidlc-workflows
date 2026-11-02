---
id: PD-1
title: An obligation is owed only if the customer's ordinary use reaches it
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

# PD-1 — An obligation is owed only if the customer's ordinary use reaches it

An **obligation** is anything a seat makes owed: a requirement written at Gate 1, a lock clause as Gate 3 makes it, a code path, test, fixture, check or kept artefact a seat requests, or a finding whose remedy is one of those. Every obligation costs its whole life to carry. This rule decides which obligations are owed.

## Finding the customer and their ordinary use

The customer and their ordinary use are found, not assumed. A judgement made from the ask alone is a guess. Run this process before weighing anything, and record its result in the `## Customer and ordinary use` section of the record's requirements artefact. The Gate 1 lead writes the section first. A later seat reads it, and when it does not answer a question that seat needs, runs the process for that question and adds the answer.

1. **Read the ask for what it is for.** State in your own words what the asker wants to be true when this is done, and who uses the result. When the ask names nobody else, the customer is the operator.
2. **Turn the obligations in front of you into questions about the customer.** Ask what you would need to know about this customer to tell whether their ordinary use reaches each obligation. The questions come from this task, never from a template.
3. **Answer the questions from the record and from measurement.** Search what is on record about the customer, more than one way and in more than one place, and follow what each answer points to; one empty search is not absence. Where the code, content or data can answer, measure it.
4. **Keep the evidence honest.** Cite each answer and mark it stated (the customer said it), standing (a rule or decision they keep), measured, or inferred (with why). Record the questions left open.
5. **Say what changed.** If what you learned changes what the ask meant, say so.

**Ordinary use** is what the process finds: the customer doing what the ask is for, in the circumstances they actually work in, including the mistakes those circumstances make likely.

## Closed conditions

1. An obligation is owed only if the customer's ordinary use reaches it: in that use, the customer would meet it, or would be let down if it failed. Being written down does not make an obligation owed. A requirement passes this test against the ask and the customer's ordinary use, never against another requirement, and an obligation is owed only as far as ordinary use reaches, whatever its wording claims.
2. The same test weighs every reason that adds work or rules out a cheaper path, including a reason to reject a candidate solution. A reason that rests on circumstances ordinary use does not reach is not a reason.
3. Handling starts at the cheapest rung and climbs only for a harm ordinary use reaches at the rung below: nothing, recorded once as a known limit; an existing path; a refusal; support. Removing code is a move down this ladder.
4. This rule applies the same way to an obligation claimed at any gate from Gate 1 to Gate 5.
5. A clause already locked at Gate 3 is not waived by this rule. It binds under "locked is scope" and moves only by lock-level ceremony. This rule weighs a lock clause when Gate 3 makes it.
6. Another discipline's rule, or a seat's own prompt, binds code that exists. It is never on its own a reason for code to exist, and a move down the ladder ends its claim. This includes a seat prompt's own harm threshold. A rule's demand on code that is owed, such as a test that rule requires for an owed file, is owed with that code.
7. This rule governs additions only. It never makes owed the removal of existing code or of an existing check, and never makes not owed a change to existing code that another rule requires.
8. A question the process cannot answer, and that decides whether an obligation is owed, is recorded with the one question that would settle it. The call made in its absence names that question and stands for the operator's review.
9. A finding whose only demand is an obligation this rule does not owe is non-blocking. The lens that raises it records it disposed, in the shape this directory's README states. At a gate that requires every finding to carry a disposition, declining it is a push-back grounded in `PD-1`, carrying the Five Whys chain the project's exception rule requires.
