---
id: CD-35
title: Public ingress bindings are capped at a single recorded one
serves-principle: IV
lens: [clean-architecture]
pairs-with: []
amended: [v2.2.0]
enforced-by:
  - manual
enforcement-note: "Public ingress binding count is a deployment-config review judgement; the cap is project configuration."
status: active
applies-to: infrastructure
portability: portable-by-config
aidlc-enforced-by:
  - lens:rin-clean-architecture-reviewer-agent
---

The number of public ingress bindings is capped at a single, recorded one, so the externally-reachable attack surface stays minimal and every public route is a deliberate choice. Adding public surface is a tracked decision with a recorded reason, not an incidental new binding. (The cap and the ingress mechanism are project configuration; the intent is minimal, deliberate public surface.)
