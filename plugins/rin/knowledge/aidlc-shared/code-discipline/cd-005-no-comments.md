---
id: CD-5
title: No comments, no JSDoc
serves-principle: II
lens: [naming]
pairs-with: []
amended: [v2.2.0]
enforced-by:
  - audit:auditConstitution
enforcement-note: "The Rin audit recognizes selected directive/comment forms; comment policy, suppression eligibility and decay still need review. Unused-disable lint does not replace that review."
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - sensor:cd-5
  - gate:rin-constitution-gate
---

Code is self-documenting: the names, types, and schemas carry the meaning. A prose comment is almost always there to excuse an unclear name or a convoluted expression — so the fix is to clarify the code, not annotate it. The only permitted annotations are machine-meaningful directives that carry a tracked reference; explanatory comments and doc-comments are not.

## Machine directives and suppression coverage

Tracked machine directives include the installed tool's supported suppression syntax:
- ESLint: disable-line/disable-next-line in line or block comments; disable/enable block regions or top-of-file disables; inline eslint rule configuration that can turn a rule off.
- Biome: biome-ignore for the next line, biome-ignore-all at file start, and paired biome-ignore-start/biome-ignore-end ranges where the installed version supports them.
- Oxlint: oxlint-disable-line/oxlint-disable-next-line, disable/enable line or block regions/rest-of-file, and its supported eslint-disable aliases. Oxlint does not support ESLint-style inline rule-option changes.

Each directive comment carries its own tracked reference, such as (spec-099), in the tool's supported description position. ESLint/oxlint descriptions use --; Biome requires an explanation after its category/rule colon. A multiline block's reference belongs to that same block. An adjacent unrelated comment's reference is insufficient.

**A machine-consumed comment is an allowed annotation shape, not permission to suppress the underlying rule.** Review the target rule's eligibility, actual scope and reason before any exception. A broad file/all-rules disable is not permitted untracked inherited debt. CD-1 still permits no exemptions; adding a tracker cannot authorize an any suppression. CD-46, when selected, still requires whole-file paydown and retirement on touch. Initial inventory requires no Five Whys.

Use the installed engine's unused-suppression reporting when available: ESLint linterOptions.reportUnusedDisableDirectives:error; oxlint options.reportUnusedDisableDirectives:error (or its report-unused-disable-directives-severity error CLI option); Biome suppression/unused diagnostics. Do not confuse a tracker with proof that a suppression remains necessary. ESLint inline rule configuration has a separate reportUnusedInlineConfigs setting. Preserve existing stricter settings; don't disable these reports to hide stale allowances.

The existing Rin CD-5 audit recognizes these directive names in actual TS/TSX comment ranges and requires (spec-NNN) within the same comment. This checks tracker syntax only: it does not resolve a task, verify tool syntax/placement, authorize the target exemption or prove full comment-ban compliance. The underlying linter validates its own supported directives; reviewer judgment still applies.

Ignore files and configuration excludes/overrides are separate scope mechanisms, not comments. Inventory them separately; excluded source/tests are uncovered, not compliant. Copying this discipline installs neither the audit nor a linter.

Sources: [ESLint rules and directives](https://eslint.org/docs/latest/use/configure/rules), [Biome suppressions](https://biomejs.dev/analyzer/suppressions/), [oxlint inline ignores](https://oxc.rs/docs/guide/usage/linter/ignore-comments.html).
