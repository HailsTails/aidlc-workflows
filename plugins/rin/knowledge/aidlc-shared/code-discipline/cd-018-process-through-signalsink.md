---
id: CD-18
title: Process-lifecycle operations arrive through an injected port
serves-principle: VI
lens: [di-discipline]
pairs-with: [cd-021]
amended: [v2.6.0]
enforced-by:
  - manual
enforcement-note: "Bare process-lifecycle calls outside the injected port are a reviewer judgement; no deterministic sensor covers them yet."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-di-discipline-reviewer-agent
---

Process-lifecycle side effects — signal handlers, exit, kill, high-resolution timing — are a capability that arrives through an injected port, not reached for ambiently on the runtime's process global. Confining them behind a port makes lifecycle behaviour composable and fakeable in tests, instead of a hidden dependency on the running process.
