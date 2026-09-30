---
id: CD-6
title: Meaningful names always — no shorthand, no filler words
serves-principle: II
lens: [naming]
pairs-with: []
amended: [v2.1.1, v2.4.0]
enforced-by:
  - biome:useNamingConvention
  - audit:auditIdentifierNames
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - biome:useNamingConvention
  - sensor:cd-6
  - gate:rin-constitution-gate
---

A name states the concept the value represents, not its shape or its category. Shorthand (single letters, truncations) and filler words (data, info, value, result, manager, handler) force the reader to reconstruct meaning the name should have carried — at every scope, including callback parameters and destructures. The name is the documentation.
