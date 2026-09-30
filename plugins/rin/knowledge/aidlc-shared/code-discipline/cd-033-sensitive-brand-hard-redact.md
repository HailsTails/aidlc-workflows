---
id: CD-33
title: Sensitive types brand-redact unconditionally
serves-principle: IV
lens: [clean-architecture]
pairs-with: []
amended: []
enforced-by:
  - manual
enforcement-note: "Sensitive brand hard-redact is a domain-type review judgement."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-clean-architecture-reviewer-agent
---

A value whose type is branded sensitive redacts unconditionally wherever it surfaces — logs, errors, serialisation — with no opt-out. Branding sensitivity into the type means the redaction travels with the value by construction, rather than depending on every call site remembering to hide it.
