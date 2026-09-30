---
id: CD-26
title: No module-mocking — module-mock means DI is wrong
serves-principle: V
lens: [di-discipline, test-discipline]
pairs-with: [cd-025]
amended: []
enforced-by:
  - audit:auditTestDiscipline
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - sensor:cd-26
  - gate:rin-constitution-gate
---

Faking happens through the unit's own injected dependencies, never by intercepting the module system. A module-mock is a signal that the dependency injection is wrong: if a unit reaches for a collaborator the test cannot substitute through the signature, the collaborator should have been a port. Fix the seam, don't mock the module.
