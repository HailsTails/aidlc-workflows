---
id: CD-11
title: Operational error envelopes are plain data, not classes
serves-principle: III
lens: [errors-as-data]
pairs-with: [cd-009, cd-010, cd-014]
amended: []
enforced-by:
  - manual
enforcement-note: "Error-envelope-as-data shape (factory + type guard, not class) is a structural review judgement."
status: active
applies-to: architecture
portability: portable
aidlc-enforced-by:
  - lens:rin-errors-as-data-reviewer-agent
---

Operational error envelopes are plain, tagged data — constructed by a factory, inspected by a type guard, dispatched by an exhaustive switch on the tag — never authored classes extending the runtime's error type. Data-shaped errors compose, narrow, and serialise; class hierarchies for operational failure do not. The only authored error class is the single startup-invariant one the throw rule permits.
