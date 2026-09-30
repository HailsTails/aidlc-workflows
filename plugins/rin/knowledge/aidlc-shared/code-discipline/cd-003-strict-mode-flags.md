---
id: CD-3
title: Strict mode flags inherited, never overridden
serves-principle: II
lens: [type-soundness]
pairs-with: []
amended: []
enforced-by:
  - tsconfig:strict
  - tsconfig:noUncheckedIndexedAccess
  - tsconfig:exactOptionalPropertyTypes
  - tsconfig:noImplicitOverride
  - tsconfig:noFallthroughCasesInSwitch
  - tsconfig:noPropertyAccessFromIndexSignature
  - tsconfig:useUnknownInCatchVariables
  - audit:auditTsconfigStrict
status: active
applies-to: typescript
portability: portable
aidlc-enforced-by:
  - tsconfig:strict
  - tsconfig:noUncheckedIndexedAccess
  - tsconfig:exactOptionalPropertyTypes
  - tsconfig:noImplicitOverride
  - tsconfig:noFallthroughCasesInSwitch
  - tsconfig:noPropertyAccessFromIndexSignature
  - tsconfig:useUnknownInCatchVariables
  - sensor:cd-3
  - gate:rin-constitution-gate
---

Every unit compiles under one shared, maximally-strict compiler configuration; no unit weakens it locally. A relaxed flag in one corner (disabling strictness, unchecked indexing, exact-optional handling, catch-variable typing) creates a zone where the type system quietly stops protecting you, and that zone spreads. Strictness is inherited, never overridden.
