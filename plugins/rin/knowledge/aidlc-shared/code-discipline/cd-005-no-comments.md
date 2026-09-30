---
id: CD-5
title: No comments, no JSDoc
serves-principle: II
lens: [naming]
pairs-with: []
amended: [v2.2.0]
enforced-by:
  - audit:auditConstitution
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - sensor:cd-5
  - gate:rin-constitution-gate
---

Code is self-documenting: the names, types, and schemas carry the meaning. A prose comment is almost always there to excuse an unclear name or a convoluted expression — so the fix is to clarify the code, not annotate it. The only permitted annotations are machine-meaningful directives that carry a tracked reference; explanatory comments and doc-comments are not.
