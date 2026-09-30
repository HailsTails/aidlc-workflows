---
id: CD-30
title: Integration tests catch composition bugs only
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-029]
amended: []
enforced-by:
  - manual
enforcement-note: "Integration tests catching only composition is a review judgement."
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - lens:rin-test-discipline-reviewer-agent
---

An integration test exists to catch composition bugs — wiring, contracts between units — not unit-level logic bugs. If an integration test is the first thing to fail on a logic error, the missing test is a unit test; add it at the base rather than diagnosing through the composed system.
