---
id: CD-43
title: Booleans are evaluative, not declarative
serves-principle: II
lens: [type-soundness]
pairs-with: [cd-040]
amended: [v2.13.0, v2.15.0]
enforced-by:
  - audit:auditBooleanParameters
status: active
applies-to: typescript
portability: portable
aidlc-enforced-by:
  - sensor:cd-43
  - gate:rin-constitution-gate
---

A boolean parameter, field, or return is an evaluative predicate the reader must decode at every call site — `true` for what? Prefer a string-literal or discriminated union that states the meaning in the value itself. Booleans that name a state or mode hide that meaning behind a bare truth value.
