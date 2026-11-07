---
id: CD-17
title: Clock is the only time source
serves-principle: VI
lens: [di-discipline, test-discipline]
pairs-with: [cd-022]
amended: [v2.6.0]
enforced-by:
  - audit:auditConstitution
  - eslint:no-restricted-syntax
enforcement-note: "Configured ESLint selectors can flag direct Date.now, performance.now and zero-argument new Date calls; other time sources and clock-port ownership need review."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - sensor:cd-17
  - gate:rin-constitution-gate
---

Time is an injected capability, not an ambient global: domain code never calls the runtime's now-primitives directly, it reads the current instant through a clock port. Real time enters through exactly one clock abstraction; tests inject a fake clock and advance it deterministically. Bare time construction anywhere else makes behaviour un-fakeable and non-deterministic.
