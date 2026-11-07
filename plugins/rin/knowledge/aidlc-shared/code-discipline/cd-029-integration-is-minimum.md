---
id: CD-29
title: Component/integration tests are the minimum, not the bulk
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-030]
amended: []
enforced-by:
  - manual
enforcement-note: "Pyramid-layer scope (unit vs integration) is a review judgement."
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - lens:rin-test-discipline-reviewer-agent
---

Integration tests are the thin layer of the pyramid, not its bulk: many unit tests at the base, few component tests in the middle, a thin smoke layer on top. Inverting the pyramid — leaning on slow, broad integration tests to catch what unit tests should — is forbidden.
