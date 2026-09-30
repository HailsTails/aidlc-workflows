---
id: CD-25
title: Unit tests fake everything outside the unit
serves-principle: V
lens: [di-discipline, test-discipline]
pairs-with: [cd-026]
amended: []
enforced-by:
  - audit:auditTestDiscipline
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - sensor:cd-25
  - gate:rin-constitution-gate
---

A unit test fakes everything outside the unit under test, injected through the unit's own seam — no real I/O, no real collaborators. The test exercises exactly one unit's logic, with every dependency a controlled fake, so a failure points at that unit and nowhere else.
