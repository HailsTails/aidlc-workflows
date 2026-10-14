---
id: CD-41
title: Orchestrators contain only orchestration
serves-principle: VI
lens: [decomposition]
pairs-with: []
amended: [v2.9.0]
enforced-by:
  - biome:noExcessiveCognitiveComplexity
  - biome:noExcessiveLinesPerFunction
  - manual
enforcement-note: "Rin configures complexity and line-count heuristics, but they cannot decide whether a function only orchestrates; small computation can pass and pure coordination can exceed limits."
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - biome:noExcessiveCognitiveComplexity
  - biome:noExcessiveLinesPerFunction
---

An orchestrator's body composes helper calls and assembles their results — nothing else. Inline branching or computation inside an orchestrator mixes two altitudes: the coordination it owns and the logic that belongs in a named helper. Keep orchestrators pure coordination so each level reads at one altitude.
