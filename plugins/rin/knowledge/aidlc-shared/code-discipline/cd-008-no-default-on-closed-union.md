---
id: CD-8
title: No default on switch over a closed discriminated union
serves-principle: II
lens: [type-soundness]
pairs-with: []
amended: []
enforced-by:
  - biome:useExhaustiveSwitchCases
status: active
applies-to: typescript
portability: portable
aidlc-enforced-by:
  - biome:useExhaustiveSwitchCases
  - sensor:cd-8
  - gate:rin-constitution-gate
---

A switch over a closed discriminated union carries no `default:` arm. Exhaustiveness is the type system's job: with no default, adding a variant surfaces as a compile error at every switch that has not handled it. A `default:` swallows that signal and lets the new variant slip through silently at runtime.
