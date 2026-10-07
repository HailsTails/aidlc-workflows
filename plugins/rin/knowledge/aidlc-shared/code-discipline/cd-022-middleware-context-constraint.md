---
id: CD-22
title: Middleware generic context constraint
serves-principle: VI
lens: [di-discipline]
pairs-with: [cd-017]
amended: [v2.3.0]
enforced-by:
  - manual
enforcement-note: "Middleware generic constraint `<TCtx extends MiddlewareContext>` is a type-system review judgement."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-di-discipline-reviewer-agent
---

Middleware carries the context it consumes through a constrained generic that each layer widens, not an open property bag — so a capability the middleware reads from context (time, logging, correlation) is guaranteed present by the type rather than defensively re-checked or defaulted. A middleware that reads a context field but leaves its context generic unbounded is the violation.
