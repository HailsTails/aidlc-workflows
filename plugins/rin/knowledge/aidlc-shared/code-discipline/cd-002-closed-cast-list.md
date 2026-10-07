---
id: CD-2
title: Closed enumerated list of permitted cast sites
serves-principle: II
lens: [type-soundness]
pairs-with: [cd-015, cd-045]
amended: [v2.2.0, v2.8.0]
enforced-by:
  - audit:auditCastExpressions
status: active
applies-to: typescript
portability: portable
aidlc-enforced-by:
  - sensor:cd-2
  - gate:rin-constitution-gate
---

A type assertion tells the compiler the value is something the compiler cannot see — it is a claim the type system can no longer check. Casting is therefore permitted only at a closed, enumerated list of sites where an external boundary genuinely forces it (library-introspection and raw-row narrowing shapes the project names explicitly). Everywhere else a cast is a design smell: the type is wrong, so fix the type rather than assert over it. Adding a site to the permitted list is a deliberate, recorded amendment, not an inline decision.
