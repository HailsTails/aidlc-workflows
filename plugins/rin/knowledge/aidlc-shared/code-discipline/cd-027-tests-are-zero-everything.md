---
id: CD-27
title: Tests are zero-everything — zero logic, zero branches, zero unpredictability
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-010]
amended: [v2.9.0]
enforced-by:
  - audit:auditTestDiscipline
  - biome:noFocusedTests
  - biome:noSkippedTests
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - biome:noFocusedTests
  - biome:noSkippedTests
  - sensor:cd-27
  - gate:rin-constitution-gate
---

Test bodies are zero-logic straight lines: no branching, no loops, no try, no ternary, no computed expectations — just arrange, act, assert against hardcoded values. Logic in a test is untested code testing code; variability is faked and pinned, never accommodated with a conditional.
