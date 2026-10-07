---
id: CD-9
title: All operational failures return Result<T, E>
serves-principle: III
lens: [errors-as-data]
pairs-with: [cd-010, cd-011]
amended: []
enforced-by:
  - manual
enforcement-note: "Totality of `Result<T,E>` across operational failure paths is a structural review judgement."
status: active
applies-to: architecture
portability: portable
aidlc-enforced-by:
  - lens:rin-errors-as-data-reviewer-agent
---

Every expected, operational failure is modelled as data — a result-shaped return carrying a tagged error union that enumerates each way the operation can fail — not raised as an exception. Infrastructure failure is an operational outcome, not an escape into throwing. Callers dispatch on the error as a value, so no failure path is invisible in the type.
