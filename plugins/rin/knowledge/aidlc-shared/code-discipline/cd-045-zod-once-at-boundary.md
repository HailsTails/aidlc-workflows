---
id: CD-45
title: Zod runs exactly once per external-boundary crossing
serves-principle: II
lens: [zod-boundary]
pairs-with: [cd-004, cd-002]
amended: [v2.14.0]
enforced-by:
  - manual
enforcement-note: "Once-at-boundary semantic is a structural review judgement; no surface to grep."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-zod-boundary-reviewer-agent
---

Validation runs exactly once, at the boundary crossing, and yields a plain internal shape the rest of the code trusts by construction — it is never re-run deeper in, and the validation library's types never leak inward. Parse once at the seam, map to a domain shape, and let the inner layers depend on that shape, not on the validator.
