---
id: CD-7
title: No categorical filenames or folder names
serves-principle: II
lens: [naming]
pairs-with: [cd-007a]
amended: [v2.3.0]
enforced-by:
  - biome:useFilenamingConvention
  - audit:auditConstitution
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - biome:useFilenamingConvention
  - sensor:cd-7
  - gate:rin-constitution-gate
---

A file or folder is named for the abstraction it holds, not for a category of things. A junk-drawer name (utils, helpers, common, shared, types, misc) signals a missing primitive: the code inside wants a real home named for what it does. Category names accrete unrelated code because anything can be justified into them.
