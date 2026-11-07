---
id: CD-32
title: PII strings redact-by-default in structured logs
serves-principle: IV
lens: [clean-architecture]
pairs-with: []
amended: []
enforced-by:
  - manual
enforcement-note: "PII redact-by-default in structured logs is a logger-config review judgement."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-clean-architecture-reviewer-agent
---

Structured logs redact personally-identifying data by default; a field becomes loggable only by explicitly opting in as safe. Redaction is the default so a new field is never accidentally leaked into logs — safety is the resting state, exposure the deliberate exception.
