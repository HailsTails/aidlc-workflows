---
id: CD-31
title: No coverage thresholds
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-024]
amended: []
enforced-by:
  - manual
enforcement-note: "Absence of coverage thresholds is a CI-config posture; reviewer judgement."
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - lens:rin-test-discipline-reviewer-agent
---

Coverage is a diagnostic to read, not a gate to pass. A percentage threshold rewards tests written to move a number; the real floor is the every-file test sibling. Chasing a coverage figure produces assertion-free tests that raise the metric and protect nothing.
