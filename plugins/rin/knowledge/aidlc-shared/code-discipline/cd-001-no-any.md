---
id: CD-1
title: No any, ever
serves-principle: II
lens: [type-soundness]
pairs-with: []
amended: []
enforced-by:
  - biome:noExplicitAny
  - biome:noImplicitAnyLet
status: active
applies-to: typescript
portability: portable
aidlc-enforced-by:
  - biome:noExplicitAny
  - biome:noImplicitAnyLet
  - sensor:cd-1
  - gate:rin-constitution-gate
---

`any` is the absence of a type: it tells the compiler to stop checking, and that hole propagates silently through every call site that consumes the value. The whole reason a type system exists — catching shape errors before runtime — is forfeited at each `any`. Reach for `unknown` and narrow at the read site, or a precise union. There are no carve-outs: every `any` is a violation regardless of stated reason.
