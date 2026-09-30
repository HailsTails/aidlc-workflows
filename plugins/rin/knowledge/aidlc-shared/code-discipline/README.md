# Code Discipline (CD-N) Index

Index of code disciplines. The spirit lives in [constitution.md](../constitution.md); enforcement details for each CD live in the linked file.

Reviews cite by ID — "violates CD-7" — to make remediation precise.

Each entry's `[…]` tag lists the enforcement mechanisms that back the rule. `[manual]` means there is no automated backstop — the rule is reviewer-judgement only and is the agent's hardest case.

## Canonical source, rules-as-data, and the lens harness

The `cd-*.md` files in this directory are the **single source of truth** for the binding rule text. Nothing else holds rule prose — the rules are **data** consumed by two harness layers that hold no copy of their own:

- **`.claude/knowledge/aidlc-shared/lenses/<lens>/lens.md`** — the gate-3 lenses. Each lens is a **codebase-agnostic audit method**: the concept it defends, a generic inspection procedure expressed against "the rules tagged for this lens", letter-vs-intent guidance, and an output shape. A lens names no specific rule numbers, file paths, type names, or library names. It is *fuelled by* the rules in this directory: a rule belongs to a lens via a `lens:` list in its frontmatter (e.g. `lens: [errors-as-data]`). At audit time the lens agent globs `cd-*.md`, keeps every rule whose `lens:` list contains its name, and treats their text — including each rule's `## Carve-outs` — as authoritative. Because the rules are data, the same lens harness runs against any codebase that ships this layout; rin's CD set is just one ruleset.
- **`CLAUDE.md` (repo root, "Engineering standards")** — an orientation map only: principle → which CD rules, with pointers here. It carries **no rule prose**.

### The `lens:` tag (rule → owning lens)

Each rule that an audit lens enforces declares a `lens:` list in its frontmatter naming its **primary owning lens** (the list form is forward-compatible with a rule shared by two lenses). One rule → one primary lens. When one lens needs to notice a violation another lens owns (e.g. zod-boundary spotting a missing-schema boundary via the cast rule type-soundness owns), that cross-reference is expressed as *method* in the noticing lens's `lens.md` — the rule is **not** re-tagged. Some rules carry no `lens:` tag because no audit lens enforces them (CD-37–CD-39 are upstream spec-driven gates); that is expected, not a gap.

### Changing a rule

Edit the `cd-*.md` file here (and the matching `constitution.md` principle if the spirit shifts). That is the only edit — the lenses read the new text at run time, so there is no copy to re-sync. To move a rule between lenses, change its `lens:` list here. Do not put rule prose in a lens or in CLAUDE.md.

## I. Spec-Driven Delivery

- **CD-37** — Every change covered by a `tasks.md` entry ([cd-037-spec-coverage.md](cd-037-spec-coverage.md)) [manual]
- **CD-38** — Constitution Check is a gate in every plan ([cd-038-constitution-check-gate.md](cd-038-constitution-check-gate.md)) [manual]
- **CD-39** — Cite principles by Roman numeral and rules by ID ([cd-039-cite-by-id.md](cd-039-cite-by-id.md)) [manual]
- **CD-46** — Touching a carved-out file revokes its carve-out — leave it clean ([cd-046-decarve-on-touch.md](cd-046-decarve-on-touch.md)) [script:check-carve-out-decay, manual]

## II. TypeScript-First, Zero Casting, Self-Documenting Names

- **CD-1** — No `any`, ever ([cd-001-no-any.md](cd-001-no-any.md)) [biome:noExplicitAny, biome:noImplicitAnyLet]
- **CD-2** — Closed enumerated list of permitted cast sites ([cd-002-closed-cast-list.md](cd-002-closed-cast-list.md)) [audit:auditCastExpressions]
- **CD-3** — Strict mode flags inherited, never overridden ([cd-003-strict-mode-flags.md](cd-003-strict-mode-flags.md)) [tsconfig:strict, tsconfig:noUncheckedIndexedAccess, tsconfig:exactOptionalPropertyTypes, tsconfig:noImplicitOverride, tsconfig:noFallthroughCasesInSwitch, tsconfig:noPropertyAccessFromIndexSignature, tsconfig:useUnknownInCatchVariables, audit:auditTsconfigStrict]
- **CD-4** — Zod at every external boundary ([cd-004-zod-at-boundaries.md](cd-004-zod-at-boundaries.md)) [manual]
- **CD-5** — No comments, no JSDoc ([cd-005-no-comments.md](cd-005-no-comments.md)) [audit:auditConstitution]
- **CD-6** — Meaningful names always — no shorthand, no filler words ([cd-006-meaningful-names.md](cd-006-meaningful-names.md)) [biome:useNamingConvention, audit:auditIdentifierNames]
- **CD-7** — No categorical filenames or folder names ([cd-007-no-categorical-filenames.md](cd-007-no-categorical-filenames.md)) [biome:useFilenamingConvention, audit:auditConstitution]
- **CD-7a** — No `ReturnType<typeof X>` for our own codebase ([cd-007a-no-returntype-typeof.md](cd-007a-no-returntype-typeof.md)) [manual]
- **CD-8** — No `default:` on switch over a closed discriminated union ([cd-008-no-default-on-closed-union.md](cd-008-no-default-on-closed-union.md)) [biome:useExhaustiveSwitchCases]
- **CD-40** — Single-object-argument functions ([cd-040-single-object-arg.md](cd-040-single-object-arg.md)) [biome:useMaxParams]
- **CD-43** — Booleans are evaluative, not declarative ([cd-043-booleans-are-evaluative.md](cd-043-booleans-are-evaluative.md)) [audit:auditBooleanParameters]
- **CD-45** — Zod runs exactly once per external-boundary crossing ([cd-045-zod-once-at-boundary.md](cd-045-zod-once-at-boundary.md)) [manual]

## III. Clean Architecture, Errors-As-Data (Total)

- **CD-9** — All operational failures return `Result<T, E>` ([cd-009-result-shaped-failures.md](cd-009-result-shaped-failures.md)) [manual]
- **CD-10** — Throws permitted in exactly two contexts ([cd-010-throws-closed-list.md](cd-010-throws-closed-list.md)) [biome:useThrowOnlyError, audit:auditTestDiscipline]
- **CD-11** — Operational error envelopes are plain data, not classes ([cd-011-error-shapes-are-data.md](cd-011-error-shapes-are-data.md)) [manual]
- **CD-12** — Repositories are the primary storage abstraction ([cd-012-repositories-as-storage-abstraction.md](cd-012-repositories-as-storage-abstraction.md)) [manual]
- **CD-13** — Kernel layer boundaries are non-negotiable ([cd-013-kernel-layer-boundaries.md](cd-013-kernel-layer-boundaries.md)) [manual]

## IV. Self-Hosted, Minimal Surface

- **CD-32** — PII strings redact-by-default in structured logs ([cd-032-pii-redact-by-default.md](cd-032-pii-redact-by-default.md)) [manual]
- **CD-33** — Sensitive types brand-redact unconditionally ([cd-033-sensitive-brand-hard-redact.md](cd-033-sensitive-brand-hard-redact.md)) [manual]
- **CD-34** — Secrets never enter the repo ([cd-034-secrets-never-in-repo.md](cd-034-secrets-never-in-repo.md)) [manual]
- **CD-35** — Tailscale Funnel binding count is exactly one ([cd-035-funnel-binding-cap.md](cd-035-funnel-binding-cap.md)) [manual]
- **CD-36** — Per-service steady-state RAM cap is 200 MB ([cd-036-per-service-ram-cap.md](cd-036-per-service-ram-cap.md)) [manual]

## V. Testing Pyramid: Unit Isolation, Integration Minimum

- **CD-23** — Tests co-located with the unit they cover ([cd-023-tests-co-located.md](cd-023-tests-co-located.md)) [audit:auditConstitution]
- **CD-24** — Every file is unit-tested ([cd-024-every-file-unit-tested.md](cd-024-every-file-unit-tested.md)) [audit:auditConstitution]
- **CD-25** — Unit tests fake everything outside the unit ([cd-025-fake-everything-outside-unit.md](cd-025-fake-everything-outside-unit.md)) [audit:auditTestDiscipline]
- **CD-26** — No module-mocking — module-mock means DI is wrong ([cd-026-no-module-mocking.md](cd-026-no-module-mocking.md)) [audit:auditTestDiscipline]
- **CD-27** — Tests are zero-everything — zero logic, zero branches, zero unpredictability ([cd-027-tests-are-zero-everything.md](cd-027-tests-are-zero-everything.md)) [audit:auditTestDiscipline, biome:noFocusedTests, biome:noSkippedTests]
- **CD-28** — Tests assert only what the unit is directly responsible for ([cd-028-assert-only-unit-responsibility.md](cd-028-assert-only-unit-responsibility.md)) [manual]
- **CD-29** — Component/integration tests are the minimum, not the bulk ([cd-029-integration-is-minimum.md](cd-029-integration-is-minimum.md)) [manual]
- **CD-30** — Integration tests catch composition bugs only ([cd-030-integration-catches-composition-only.md](cd-030-integration-catches-composition-only.md)) [manual]
- **CD-31** — No coverage thresholds ([cd-031-no-coverage-thresholds.md](cd-031-no-coverage-thresholds.md)) [manual]
- **CD-47** — Tests are hermetic — no real side effects on anything real (real-git spawning is the first mechanically-enforced class) ([cd-047-tests-are-hermetic.md](cd-047-tests-are-hermetic.md)) [script:audit:hermetic-git]

## VI. Function-First Composition

- **CD-14** — Zero class authoring; classes only at external-library call sites ([cd-014-no-class-authoring.md](cd-014-no-class-authoring.md)) [biome:noStaticOnlyClass, audit:auditConstitution, audit:auditPublicSurface]
- **CD-15** — No `for…of`; functional iteration only ([cd-015-no-for-of.md](cd-015-no-for-of.md)) [manual]
- **CD-16** — No counted `for` loops ([cd-016-no-counted-for.md](cd-016-no-counted-for.md)) [manual]
- **CD-17** — Clock is the only time source ([cd-017-clock-only-time-source.md](cd-017-clock-only-time-source.md)) [audit:auditConstitution]
- **CD-18** — Process operations through `SignalSink` DI port ([cd-018-process-through-signalsink.md](cd-018-process-through-signalsink.md)) [manual]
- **CD-19** — Third-party library imports confined to wrapping-factory files ([cd-019-third-party-wrapping-factories.md](cd-019-third-party-wrapping-factories.md)) [audit:auditConstitution]
- **CD-20** — All `node:` stdlib imports through kernel-supplied DI ports ([cd-020-node-stdlib-through-ports.md](cd-020-node-stdlib-through-ports.md)) [audit:auditConstitution]
- **CD-21** — Every kernel-supplied port ships a default factory ([cd-021-ports-ship-default-factory.md](cd-021-ports-ship-default-factory.md)) [manual]
- **CD-22** — Middleware generic context constraint ([cd-022-middleware-context-constraint.md](cd-022-middleware-context-constraint.md)) [manual]
- **CD-41** — Orchestrators contain only orchestration ([cd-041-orchestrators-only-orchestrate.md](cd-041-orchestrators-only-orchestrate.md)) [biome:noExcessiveCognitiveComplexity, biome:noExcessiveLinesPerFunction]
- **CD-42** — Unhappy paths are early returns; happy path is the final return ([cd-042-unhappy-path-early-return.md](cd-042-unhappy-path-early-return.md)) [biome:noUselessElse]
- **CD-44** — Functions must not mutate fields of parameters they receive ([cd-044-no-parameter-field-mutation.md](cd-044-no-parameter-field-mutation.md)) [audit:auditInputMutation, biome:noParameterAssign]
