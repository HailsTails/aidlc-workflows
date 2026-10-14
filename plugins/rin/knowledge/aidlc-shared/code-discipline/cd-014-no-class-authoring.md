---
id: CD-14
title: Zero class authoring; classes only at external-library call sites
serves-principle: VI
lens: [function-first]
pairs-with: [cd-010, cd-011]
amended: []
enforced-by:
  - biome:noStaticOnlyClass
  - eslint:no-restricted-syntax
  - audit:auditConstitution
  - audit:auditPublicSurface
enforcement-note: "The opt-in tools/native-lint/cd14 local plugin checks authored class syntax in ESLint/Oxlint; its separate Biome Grit file does likewise. Biome's built-in catches static-only classes only. Review external construction and wrapper placement."
status: active
applies-to: typescript-runtime
portability: portable
aidlc-enforced-by:
  - biome:noStaticOnlyClass
  - sensor:cd-14
  - gate:rin-constitution-gate
---

Behaviour is composed from functions and closures, not authored classes — state lives in a factory that closes over it. A class appears only where an external library's API demands `new` at the call site; that instance is created inside the wrapping factory and held internally, never re-exported as a class. The rule is per-declaration, not per-export: even a non-exported authored class is a violation.

The optional `tools/native-lint/cd14/` asset adds a dedicated
`rin-discipline/no-class-authoring` rule for ordinary ESLint/Oxlint runs and a
separate Biome Grit check. It can sit beside a consumer's existing lint rules;
its syntax result does not establish the external-library/wrapper conditions.
The current line-based audit and native parser do not have identical TS ambient
or class-expression coverage; review their findings separately during adoption.
