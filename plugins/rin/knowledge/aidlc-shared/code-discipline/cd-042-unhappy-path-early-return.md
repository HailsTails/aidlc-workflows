---
id: CD-42
title: Unhappy paths are early returns; happy path is the final return
serves-principle: VI
lens: [decomposition]
pairs-with: []
amended: [v2.9.0]
enforced-by:
  - biome:noUselessElse
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - biome:noUselessElse
---

Unhappy paths are handled first as guard clauses that return early; the happy path is the final, un-nested return at the bottom. There is no `else` after an early return. Guarding first keeps the main path flat and readable, instead of burying it inside nested conditionals.
