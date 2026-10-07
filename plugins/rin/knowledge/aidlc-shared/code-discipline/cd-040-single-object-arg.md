---
id: CD-40
title: Single-object-argument functions
serves-principle: II
lens: [function-first]
pairs-with: [cd-043]
amended: [v2.4.0]
enforced-by:
  - biome:useMaxParams
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - biome:useMaxParams
---

A function takes a single named-field object argument rather than a positional parameter list, so every call site reads as a labelled contract instead of a sequence of unlabelled values whose meaning depends on order. Named fields also make adding or reordering parameters a safe, non-breaking change.
