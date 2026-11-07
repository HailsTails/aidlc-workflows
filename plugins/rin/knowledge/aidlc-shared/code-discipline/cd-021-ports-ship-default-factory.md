---
id: CD-21
title: Every injected port ships a default production factory
serves-principle: VI
lens: [di-discipline]
pairs-with: [cd-018, cd-019, cd-020]
amended: [v2.16.0]
enforced-by:
  - manual
enforcement-note: "Default-factory presence per port is a structural review judgement."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-di-discipline-reviewer-agent
---

A port is not just an interface — it ships its own default production implementation, co-located in the same module. Wiring is then trivial and there is exactly one canonical construction site per capability; production wires the default, tests supply their own fakes. A port with no default factory is an incomplete capability.
