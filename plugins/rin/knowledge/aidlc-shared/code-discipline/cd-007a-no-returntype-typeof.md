---
id: CD-7a
title: No ReturnType<typeof X> for our own codebase
serves-principle: II
lens: [type-soundness]
pairs-with: [cd-007]
amended: [v2.5.0]
enforced-by:
  - manual
enforcement-note: "Detecting `ReturnType<typeof X>` over an OWN symbol vs an external one requires resolving the symbol's origin; reviewer judgement."
status: active
applies-to: typescript
portability: portable
aidlc-enforced-by:
  - lens:rin-type-soundness-reviewer-agent
  - sensor:cd-7a
  - gate:rin-constitution-gate
---

Every type the code produces is named and exported, and callers use that named type. Deriving a type from a factory's inferred return couples the type to the implementation, hides it from find-usages, and breaks the moment the factory's internals shift. The single carve-out is an external library symbol whose package exports no named return type.
