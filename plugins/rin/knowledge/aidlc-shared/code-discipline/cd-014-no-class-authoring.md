---
id: CD-14
title: Zero class authoring; classes only at external-library call sites
serves-principle: VI
lens: [function-first]
pairs-with: [cd-010, cd-011]
amended: []
enforced-by:
  - biome:noStaticOnlyClass
  - audit:auditConstitution
  - audit:auditPublicSurface
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - biome:noStaticOnlyClass
  - sensor:cd-14
  - gate:rin-constitution-gate
---

Behaviour is composed from functions and closures, not authored classes — state lives in a factory that closes over it. A class appears only where an external library's API demands `new` at the call site; that instance is created inside the wrapping factory and held internally, never re-exported as a class. The rule is per-declaration, not per-export: even a non-exported authored class is a violation.
