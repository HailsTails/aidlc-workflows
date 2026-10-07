---
id: CD-20
title: Runtime stdlib imports arrive through injected ports
serves-principle: VI
lens: [di-discipline]
pairs-with: [cd-019, cd-021]
amended: [v2.3.0]
status: collapsed-into
collapsed-into: CD-19
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - sensor:cd-19
  - gate:rin-constitution-gate
---

Collapsed into [CD-19](./cd-019-third-party-wrapping-factories.md) — confining the
runtime's own standard library behind a wrapping port is the same intent as
confining a third-party dependency (CD-20 was originally split out of CD-19). CD-19
now covers both third-party and stdlib dependencies. This id is retained as a
redirect so existing citations resolve; it is not independently enforced.
