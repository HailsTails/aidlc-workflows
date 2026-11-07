---
id: CD-36
title: Each service is designed to a hard steady-state resource budget
serves-principle: IV
lens: [clean-architecture]
pairs-with: []
amended: [v2.2.0]
enforced-by:
  - manual
enforcement-note: "Per-service RAM cap is an ops measurement; reviewer judgement at design."
status: active
applies-to: infrastructure
portability: portable-by-config
aidlc-enforced-by:
  - lens:rin-clean-architecture-reviewer-agent
---

Each service is designed to a hard steady-state resource budget — stream rather than buffer, bound the caches — rather than assuming headroom. Exceeding the budget is a tracked exception that must state why no in-budget alternative exists. (The specific figure is project configuration; the intent is designing to an explicit budget rather than discovering the ceiling in production.)
