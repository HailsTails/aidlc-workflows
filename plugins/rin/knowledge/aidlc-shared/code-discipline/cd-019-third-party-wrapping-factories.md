---
id: CD-19
title: External dependencies confined to wrapping ports at the boundary
serves-principle: VI
lens: [function-first]
pairs-with: [cd-021]
collapses: [cd-020]
amended: [v2.9.0, v2.16.0, v2.18.0, v2.19.0, v2.20.0]
enforced-by:
  - audit:auditConstitution
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - sensor:cd-19
  - gate:rin-constitution-gate
---

Every dependency on code the project does not own — a third-party library or the runtime's own standard library alike — is confined to a single wrapping port at the boundary; the rest of the codebase depends on that port, never the vendor or platform surface, runtime or type-only. A dependency swap then touches one file, the vendor's types never leak inward, and each confined capability is nameable and fakeable in tests. There is no inline carve-out: a stdlib call in the middle of business logic is as much a violation as a scattered library import. Opening a new wrapping site for a new dependency is a deliberate, recorded decision.
