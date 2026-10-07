---
id: CD-28
title: Tests assert only what the unit is directly responsible for
serves-principle: V
lens: [test-discipline]
pairs-with: []
amended: []
enforced-by:
  - manual
enforcement-note: "Delegation assertion shape is a test-structure review judgement."
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - lens:rin-test-discipline-reviewer-agent
---

A test asserts the unit's own direct responsibility — its returned output and the calls it makes to its collaborators — not the transitive internals of those collaborators. Asserting through a dependency couples the test to code the unit does not own and makes it fail for the wrong reasons.
