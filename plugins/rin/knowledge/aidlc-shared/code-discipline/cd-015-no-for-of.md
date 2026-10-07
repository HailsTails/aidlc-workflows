---
id: CD-15
title: Iteration is functional transformation, never an imperative loop
serves-principle: VI
lens: [function-first]
pairs-with: [cd-002]
collapses: [cd-016]
amended: [v2.8.0, v2.9.0]
enforced-by:
  - manual
enforcement-note: "Biome has no for-of ban; reviewer judgement."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - lens:rin-function-first-reviewer-agent
  - sensor:cd-15
  - gate:rin-constitution-gate
---

Iteration is a transformation, expressed with `map`, `reduce`, `flatMap`, `filter`, or `Array.from` — so it reads as data flowing through a pipeline rather than as mutable imperative stepping. Pure side-effect iteration (logging, registering listeners) uses `forEach` with a callback that returns void. The two imperative shapes this rule replaces are element iteration (`for…of`) and counted iteration (`for (let i = 0; …; i++)`): the first becomes a functional traversal, and the second becomes `Array.from({ length }, mapper)` where the index is derived from position rather than incremented by a manual counter that can drift out of bounds.

**Async stream consumption is iteration this rule does not reach.** Draining an `AsyncIterable` — pulling `await iterator.next()` until exhaustion, or the `for await…of` that desugars to it — is permitted at sites declared as authorised locations for CD-15. The functional forms cannot express it: `map`/`reduce`/`flatMap` over an `AsyncIterable` require materialising the whole stream, which destroys the bounded-residency property that streaming exists to provide. This is a structural fact about the language, not debt — a drain loop at a declared site is fully compliant, carries no paydown obligation, and takes an authorised-location entry, never a carve-out. Everything the rule does reach still binds inside such a loop: the body is a transformation, accumulator updates are whole-value replacements rather than in-place mutation, and synchronous iteration over materialised collections stays functional.
