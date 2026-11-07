---
id: CD-16
title: No counted for loops
serves-principle: VI
lens: [function-first]
pairs-with: [cd-015]
amended: []
status: collapsed-into
collapsed-into: CD-15
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - sensor:cd-15
  - gate:rin-constitution-gate
---

Collapsed into [CD-15](./cd-015-no-for-of.md) — counted-loop iteration and
element iteration are two faces of the same intent (iteration is functional
transformation, not imperative looping). CD-15 now carries both. This id is
retained as a redirect so existing citations resolve; it is not independently
enforced.
