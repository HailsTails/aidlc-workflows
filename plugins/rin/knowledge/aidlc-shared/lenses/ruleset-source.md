# Where a lens loads its rules

A lens is a method, and the rules it applies are data. Where that data lives
depends on the constitution engine the codebase under review declares in its
`harness.config.json`: `constitution.engine`, which is `rin-walker` when absent.
Read the value from the review worktree's own `harness.config.json`. Never
assume it.

## `rin-walker` (default)

The ruleset is the code-discipline directory:
`{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/`, beside the
constitution, unless the dispatching workflow states another resolved path.
Each rule is a `cd-*.md` file. A rule belongs to a lens when its frontmatter
`lens:` value names that lens. Its exceptions are the `## Carve-outs` section
and the records under `.constitution-carve-outs/` and
`.constitution-authorised-locations/`.

## `discipline-core`

The ruleset is the codebase's adopted disciplines:

1. Read `disciplines.json` at the repository root. A discipline is adopted when
   at least one of its clauses appears in `clauses`. A clause address is
   `[<ruleSet>/]<DisciplineId>#<clauseId>`, and no prefix means the shared rule
   set.
2. The rule page of a shared discipline is
   `tools/discipline-core/rules/<DisciplineId>/README.md`. The rule page of a
   repository rule set's discipline is
   `<ruleSets[<ruleSet>]>/<DisciplineId>/README.md`, where the directory comes
   from `disciplines.json` `ruleSets`.
3. A rule page belongs to a lens when its `Review lens:` line links that lens
   by name. A page whose line reads `Review lens: none` belongs to no lens.
4. The page's text, including its `## Rule` section and what it says no check
   flags, is authoritative: the lens reviews the whole rule, not only what the
   mechanical clauses catch. Its exceptions are the records in
   `discipline-exceptions.json` for that discipline's clauses. A finding
   covered by a record there is not a finding. A record whose file the change
   touches is forfeited and is a finding (CD-46).
5. Cite a finding by discipline id and, where one applies, clause address
   (`CD-15#loops`).

### Looking up a cited rule by id

A lens that loads no tagged rules (defended-on-intent, which re-tests other
lenses' PASS claims, and ddd-modelling) instead looks up the rule each claim or
finding cites. It does not match on `Review lens:`. A cited `CD-n` resolves to
`tools/discipline-core/rules/CD-n/README.md`. A cited `<ruleSet>/<Id>`
resolves to `<ruleSets[<ruleSet>]>/<Id>/README.md`. A clause address
`<Id>#<clause>` resolves to the same page, at that clause's row in its
`## Clauses` table. The page holds whatever its `Review lens:` line says. A
cited id with no such page is a citation of a rule that does not exist, and is
reported as one.

If `disciplines.json` is missing or adopts no discipline at all, or the rule
page directory does not exist, STOP and return CANNOT-REVIEW naming the path
that was resolved. That is an unloadable ruleset, never a codebase without
discipline.
