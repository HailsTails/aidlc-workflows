---
id: CD-4
title: Zod at every external boundary
serves-principle: II
lens: [zod-boundary]
pairs-with: [cd-045]
amended: []
enforced-by:
  - manual
enforcement-note: "Zod-at-boundary placement is a structural review judgement; no surface to grep."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-zod-boundary-reviewer-agent
---

Every crossing from the untyped outside world — HTTP, environment, files, database rows, inter-process input — is validated by a schema at the seam and handed inward as plain typed data. The boundary is the one place the program does not yet know the shape of its input; parse it there, once, so everything deeper can trust its types.
