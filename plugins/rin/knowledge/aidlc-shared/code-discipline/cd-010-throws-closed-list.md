---
id: CD-10
title: Throws permitted in exactly two contexts
serves-principle: III
lens: [errors-as-data]
pairs-with: [cd-009, cd-011, cd-014, cd-027]
amended: [v2.2.0]
enforced-by:
  - biome:useThrowOnlyError
  - audit:auditTestDiscipline
status: active
applies-to: architecture
portability: portable
aidlc-enforced-by:
  - biome:useThrowOnlyError
  - sensor:cd-10
  - gate:rin-constitution-gate
---

Throwing is confined to a closed, named set of contexts: a startup-invariant check that fails at boot, and a branch made unreachable by exhaustive type narrowing. Defensive throws — "this should never happen", "guard against impossible state" — are forbidden: if you can name the state, you can model it as a result variant. A library that throws is caught at the boundary and converted to a result. Tests carry no exemption; they surface failures through assertions, not by throwing.
