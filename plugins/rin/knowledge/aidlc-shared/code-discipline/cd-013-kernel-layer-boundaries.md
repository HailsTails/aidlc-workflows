---
id: CD-13
title: Kernel layer boundaries are non-negotiable
serves-principle: III
lens: [clean-architecture]
pairs-with: []
amended: []
enforced-by:
  - manual
enforcement-note: "Domain/application/adapter/transport layer boundaries are a structural review judgement."
status: active
applies-to: architecture
portability: portable
aidlc-enforced-by:
  - lens:rin-clean-architecture-reviewer-agent
---

Dependencies point inward and only inward: the domain depends on nothing, the application layer orchestrates the domain, adapters implement the ports the inner layers declare, and transports are leaves at the edge. An inner layer importing an outer one is the violation — it is what inverts the dependency direction the architecture exists to protect.
