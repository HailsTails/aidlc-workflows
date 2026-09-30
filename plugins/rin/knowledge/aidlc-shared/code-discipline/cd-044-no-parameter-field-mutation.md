---
id: CD-44
title: Functions must not mutate fields of parameters they receive
serves-principle: VI
lens: [decomposition]
pairs-with: []
amended: [v2.13.0]
enforced-by:
  - audit:auditInputMutation
  - biome:noParameterAssign
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - biome:noParameterAssign
  - sensor:cd-44
  - gate:rin-constitution-gate
---

A function never mutates the fields of the parameters it receives — no assigning to a parameter's property, no pushing into a parameter's array, no sorting it in place. It returns new data instead. Mutating an input makes the function's effect invisible at the call site and couples the caller to an order of operations it cannot see.
