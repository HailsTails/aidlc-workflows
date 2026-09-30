---
lens: [completeness]
fuelled-by: the spec/interface artefacts under review (this lens enforces interface completeness, not numbered rules)
---

# Completeness lens

A reusable audit method, not a ruleset. Unlike the rule-fuelled lenses, this lens
loads **no numbered code-discipline rules** — it is a structural checklist over
the spec/plan/contracts/data-model surface under review. Its fuel is the
interface artefacts themselves: every signature, contract, persisted shape,
event surface, and integration touch the spec declares. This file describes only
*how* the lens reads that surface — the concept, the inspection questions, and
the output shape. It names no specific rule numbers, file paths, type names, or
library names; the codebase's own type system and conventions supply those.

## Concept

This lens defends **interface-surface completeness**: every interface element on
the spec surface is either **fully specified** — concrete types, named errors,
decided semantics, contracted integrations — or it is an incompleteness finding.
There is no third state. "Reasonable default", "we'll figure it out", and "TBD"
are the same finding expressed three ways.

The concept recurs across codebases under different names (a design review, an
interface-lock gate, a "no underspecified surface ships" rule). What stays
constant is the structural discipline: walk every interface element against a
fixed list of completeness questions, and for each question record exactly one
of two outcomes — **Covered** (cite where the spec grounds the answer
concretely) or **Gap** (name the element, name what's missing, name what would
make it complete). "Looks fine" is not an outcome. The checklist is the
anti-laziness mechanism: skipping ahead, or a blanket "N/A" without a stated
reason, is itself a finding against the audit.

## Loading the ruleset

This lens has no `cd-*.md` rules to load. Its ruleset is the interface set under
review:

1. Read the spec artefacts the dispatching workflow points at — typically the
   specification, the plan, the contracts, and the data-model. These define the
   interface surface.
2. Enumerate the interface elements: every exported signature, every contract,
   every persisted shape, every event/message surface, every external
   integration touch.
3. There is no rule-tag filter and no carve-out file. If the spec surface is
   empty (no interface elements to walk), report that and produce an empty
   finding set.

## Inspection procedure

For each interface element, walk the questions below **in order** — the
structural walk is the discipline the lens exists to enforce. Record per element,
per question, a Covered location or a named Gap. An "N/A" is acceptable only with
a stated reason on the same line (e.g. "N/A — single-result surface, no
collection returned"); a bare "N/A" is a finding against the audit itself.

- **Concrete types in load-bearing positions.** Every type parameter, field,
  parameter, and return type is concrete and named. The codebase's top/opaque
  types (the unknown/any family), open record shapes, the empty-object type, and
  unconstrained generics that every call site instantiates to one concrete type
  are findings — except where the codebase's own rules permit a narrow boundary
  use (e.g. a parse output before its discriminator narrows, or a caught-error
  binding). A type alias defined as the opaque top type ("we'll fill it in") is a
  finding.
- **Explicit return types on every exported signature.** An inferred-only return
  makes the contract a function of the implementation rather than the reverse.
  Spell out the result envelope's success AND error parameters, the async
  wrapper's inner type, a type-predicate's narrowed target, and a higher-order
  function's returned signature.
- **Error-variant exhaustiveness.** For every result-envelope return, the error
  parameter enumerates EVERY failure mode the implementation can produce. A
  single opaque variant standing in for several genuinely distinct upstream
  causes (timeout + auth + rate-limit collapsed into one), an error parameter
  typed as the language's top/opaque error type, or a missing failure mode (a
  parse failure or upstream exception the signature does not carry) is a finding.
  This question reads the *type's* coverage of the failure surface — whether a
  throw escapes the envelope is the errors-as-data lens's lane; surface both on
  the same line if both fail.
- **Async / IO semantics.** For every async or IO-touching surface, the spec
  states **timeout** (a number, or "none" — "we'll set one later" is a finding),
  **cancellation** (mechanism and post-cancellation state, or "not supported"),
  and **retry** (who retries, on which variants, or "neither"). Each is either
  decided concretely or named not-applicable-because.
- **Collections: pagination AND ordering.** For every collection-returning
  surface (array, async-iterable, stream, paged response), the **pagination
  model** (cursor / offset / keyset / unpaged-with-cap / unpaged, with page
  bounds and end-signal if paged) and the **ordering guarantee** (total order on
  which key / partial / none — and if none, whether the consumer accepts that and
  it is stated) are both explicit.
- **Mutations: idempotency decided.** For every state-mutating operation, the
  **idempotency model** (at-most-once / at-least-once / exactly-once /
  not-required-because) is named — with an idempotency key or dedup strategy if
  at-least-once, or a transactional boundary if exactly-once.
- **External integrations contracted, not prose.** Every reference to an external
  system (third-party API, another bounded context, broker, database, file
  system) has a typed contract on the surface — request, response, and error
  shapes — not a prose sentence ("we'll call the X API"). A referenced contract
  file counts; a prose promise does not.
- **Discriminated unions complete.** Every union on the surface names a single
  string-literal discriminator (never a boolean — a boolean cannot discriminate),
  declares its variant set intentionally closed (a set that happens to be closed
  today but could grow is a partial finding to call out), and is exhaustively
  narrowable by consumers via the type system. A union a consumer cannot assert
  exhaustiveness against is incomplete.
- **Migrations: forward AND backward.** Every migration shape (schema, on-disk
  format, message-version bump, breaking API change) states its **forward**
  semantics and its **backward** path — rollback, mid-flight reader
  compatibility, deploy-ordering requirement, abandon-mid-migration recovery. A
  forward-only migration spec is incomplete; "we don't roll back" must be stated
  and justified explicitly.
- **Persisted shapes: field-level constraints.** Every persisted field declares
  **nullability** explicitly (never inferred), **defaulting** (writer-supplied /
  defaulted-at-write / store-generated, with the mechanism named), **domain**
  (enum-shaped fields as closed unions, not the bare string type), and any
  **length/numeric bound** the semantics imply.
- **Concurrency model named.** Every surface two callers can hit concurrently
  names its **isolation level**, **conflict resolution**, and **lock scope**. A
  sequential-only / single-writer-by-design surface states that too — it is an
  answer, not a non-question.
- **Event / message surfaces: delivery semantics.** Every event-emitting or
  message-sending surface states **ordering**, **delivery** (at-most/at-least/
  exactly-once), **deduplication**, and **replay**.
- **Auth in the signature.** Every surface requiring authentication or
  authorisation carries the **principal type** in the signature (not implicit via
  middleware context) and names the **required permission / scope / capability**
  in the signature or its contract block (not deferred to runtime decoration).
  Explicitly-unauthenticated surfaces say so.
- **Vague-language scan.** Scan the spec prose for vagueness markers — "etc.",
  trailing ellipses, "and similar", "and so on", "we'll handle later", "for now",
  "temporarily", "TBD", "as appropriate", "if needed", "should probably", "might
  want to", "consider", and quantity hedges ("roughly", "approximately",
  "around") *when applied to interface semantics*. Each instance is a finding
  unless the surrounding sentence resolves it concretely on the same line. (A
  tracker-tagged TODO in code is the naming lens's lane, not this one; a "roughly
  100ms p50" performance *target* is fine — a "roughly idempotent" *contract* is
  not.)

## Letter-vs-intent

The lens's value lives in surfaces that read complete but leave a load-bearing
question open: a signature that types every parameter yet defers its timeout to
"later"; a union with a named discriminator whose set is silently open; a
migration whose forward path is airtight and whose rollback is unmentioned. A
finding must name *which* completeness question the element fails and *what
concrete answer would close it* — not a vague "underspecified". Vague phrasings
("looks thin", "needs more detail") are the lens's own failure mode and mirror
the very vagueness it audits.

This lens deliberately does NOT pursue: whether deferred work is numbered and
owned, or whether an iffy choice is forced by an upstream architectural problem
(a residue/synthesis lane); whether a result actually throws despite its
signature (errors-as-data); whether names are good (naming); whether the model
carves at its joints (ddd-modelling); whether a contract violates
single-responsibility or interface-segregation (the solid / function-first
lenses). A finding belonging to one of those lanes is flagged
`→ defer to <lens>` and pursued no further — decorrelation is the point.

## Output shape

Produce a **per-question breakdown** — the walk must be visible in the counts:
`questions-walked = Q * N`, where Q is the number of completeness questions and N
the number of interface elements. A report that does not show this multiplication
defeats the audit's own incentive. Per question, report Covered count, Gap count,
and reasoned-N/A count.

Every Gap finding is `file:line | quoted code | <question-id> | defect-named`,
citing the completeness question it fails and the concrete answer that would
close it. State the spec artefacts you walked and the interface elements you
enumerated.
