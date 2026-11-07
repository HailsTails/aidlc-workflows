---
id: CD-24
title: Every file is unit-tested
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-023, cd-031]
amended: []
status: collapsed-into
collapsed-into: CD-23
applies-to: universal
portability: portable
aidlc-enforced-by:
  - sensor:cd-23
  - gate:rin-constitution-gate
---

Collapsed into [CD-23](./cd-023-tests-co-located.md) — "every file is unit-tested"
and "tests are co-located" are one intent: every unit has a co-located test
sibling. The enforcing walker already computes them as a single check. CD-23 now
carries both. This id is retained as a redirect so existing citations resolve; it
is not independently enforced.
