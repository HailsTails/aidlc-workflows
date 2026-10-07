---
id: CD-23
title: Every unit has a co-located test sibling
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-031]
collapses: [cd-024]
amended: []
enforced-by:
  - audit:auditConstitution
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - sensor:cd-23
  - gate:rin-constitution-gate
---

Every source file ships a test sibling that sits beside it, sharing its name — there are no source files without a test, and no tests in a separate parallel tree. This is the real coverage floor: not a percentage, but the guarantee that every unit has at least one co-located test stating what it is for. Co-location makes the test the unit's visible contract and keeps the two changing together, where a parallel test tree lets them drift apart.
