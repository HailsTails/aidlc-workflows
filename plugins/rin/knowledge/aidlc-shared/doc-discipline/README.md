# Doc Discipline — DD-1..DD-6

DD-1..DD-6 are binding rule text, cited by id at review the way CD rules are. Each rule's `status:` frontmatter carries its standing.

**Binding is not the same as blocking.** The sensors that enforce these rules run `default_severity: advisory` and report rather than refuse — that is the enforcement **mechanism**, and it does not soften a rule's standing. A DD violation is a real finding a reviewer raises and an author fixes; the sensor surfaces it at write time with a pre-formed remedy rather than gating the write.

Doc Discipline is the artefact-side counterpart of Code Discipline. Where a CD rule governs a line of code, a DD rule governs a claim in a gate artefact. The two sets share their shape deliberately: one atomic file per rule, binding text with closed conditions and no soft qualifiers, and each rule declaring the mechanism that enforces it.

## Reading rules

Identical to the CD set, and for the same reason. **Soft qualifiers (`preferred`, `sparingly`, `well-justified`, `trivial`, `where readability is equal`) do not appear in rule text** — if a clause does not name an exact closed condition, it has no exception. Cite findings by `DD-N` pointing at these files, never at a summary of them.

## The rules

| id | rule | enforced by |
|---|---|---|
| [DD-1](dd-001-facts-are-keyed-rows.md) | Every measured claim is a keyed row carrying a re-derivation | sensor `dd-1` + audit |
| [DD-2](dd-002-prose-carries-no-bare-figures.md) | Prose references fact keys and states no figure of its own | sensor `dd-2` + audit |
| [DD-3](dd-003-fact-keys-resolve-intent-wide.md) | Fact keys resolve across the record; restating a keyed fact is a duplicate | sensor `dd-1` + audit |
| [DD-4](dd-004-official-artefacts-only.md) | DD rules bind the official artefacts a gate produces, and nothing else | population rule — governs every DD sensor's scope |
| [DD-5](dd-005-memory-is-append-only.md) | Discovery narration lives in memory, append-only; artefacts carry no history | judgement — review board |
| [DD-6](dd-006-required-sections.md) | A gate artefact carries the sections its stage requires | sensor `required-sections` |

## Enforcement — the same dual hookup the CDs have

A CD rule is enforced at write time by an isolated sensor **and** at gate time by the constitution audit. DD rules take the same two surfaces:

- **Sensors (advisory, write time).** One sensor per mechanically-checkable rule, declared on each rin-gates stage via frontmatter `sensors: [...]`, fired by the PostToolUse hook from the compiled stage graph's `sensors_applicable`. They report and never block. The report names the exact next edit, not the problem.
- **Audit (gate time).** A records pass in the same class as `audit:harness`, scoped to official artefacts, so a gate can read DD state without re-running every sensor.

**DD-4 is the population rule for both surfaces**, so it is not itself a sensor: it decides what the other rules see. Getting it wrong is what makes a doc checker unusable — a checker that reads `memory.md` flags the narration that rule DD-5 exists to protect.

**DD-5 is judgement, not mechanism.** Nothing can tell a script whether a paragraph is narration or reasoning. It stays with the review board, and it is listed here so the set is complete rather than only the checkable parts.

## Why this is a rule set and not a style guide

A claim stated in prose has no identity. A reviewer refuting it can only quote text, so the author fixes the quoted instance and every sibling statement survives — and the next review round finds one. Round count then rises for reasons that have nothing to do with the work being reviewed.

That cost is caused by document form rather than author discipline, which is what makes it a rule set with mechanical enforcement rather than a convention people are asked to remember. A project adopting these rules can measure its own restatement rate; the rules hold regardless of the number.
