---
lens: [ddd-modelling]
fuelled-by: the codebase constitution's modelling principles (this lens enforces concepts, not numbered rules)
---

# DDD-modelling lens

A reusable audit method, not a ruleset. Unlike the symptom lenses, this one
enforces **concepts, not numbered rules**: it has no tagged `cd-*.md` ruleset to
load. It reads the domain model for whether it is carved at its joints, and its
anchors are the codebase constitution's *modelling* clauses (layer boundaries,
boundary translation, closed unions, names-carry-meaning, ubiquitous language) —
cited as the codebase declares them, by whatever ids that constitution uses.
This file describes only *how* the lens reads a model — the concept, the
inspection procedure, and the output shape. It names no specific rule numbers,
file paths, type names, or library names; those belong to the codebase under
review and differ per codebase.

## Concept

This lens defends **carving the domain at its joints**: making illegal states
unrepresentable in the model rather than re-checking invariants in orchestrator
code, owning a value object rather than reaching into a foreign context's
interior, speaking one name per concept, and keeping storage encoding out of the
domain shape. It sits **upstream of every symptom another lens catches**: a cast,
a wrong import direction, a missing result envelope, a defensive runtime guard
are frequently downstream of a modelling fault. The discriminator for every
finding is one question — *if this were modelled right, would the downstream
symptom be impossible?* If yes, the finding is this lens's, because fixing the
model dissolves the symptom rather than patching it.

Across codebases the concept recurs under different names (Domain-Driven Design's
"ubiquitous language" and "bounded context", "make illegal states
unrepresentable", "parse don't validate", "value objects over primitives"). The
constitution under review encodes its own modelling principles — read those for
the codebase's exact discriminator, layer names, and boundary-translation idiom;
they override any default intuition.

## Loading the ruleset

This lens has **no tagged `cd-*.md` ruleset** — it is conceptual. Do not glob for
rules tagged `lens: ddd-modelling`; there are none, by design. Instead:

1. Resolve the codebase's constitution and its code-discipline directory (the
   convention is `code-discipline/` beside the constitution; the dispatching
   workflow states the resolved path).
2. Read the constitution's **modelling-relevant** principles and any rules that
   anchor the four smells below — typically the clauses governing layer
   boundaries (domain depends on nothing; adapters implement ports), the
   boundary-translation point (validate-once-then-plain-domain-shape), closed
   discriminated unions, names carrying meaning, and repositories as the storage
   abstraction. Cite findings against *those* clauses, by the ids the
   constitution declares — do not assume a fixed numbering.
3. Read the substrate the gate provides: its requirement artefact, its decision artefacts, and its design artefacts, plus any glossary prose. The requirement text is the **ubiquitous-language source**; on conflicts the requirement is authoritative, the decision prose rephrases, and the design crystallises.
4. If the codebase's constitution declares no modelling principles to anchor against, say so and produce an empty finding set — do not invent a model. **This applies only when the rule files were READ and none carry modelling principles.** If the code-discipline directory does not exist or holds zero `cd-*.md`, STOP and return CANNOT-REVIEW naming the resolved path. Ensure the pinned plugin installation and its `{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/` directory are present in the review worktree; an unloadable ruleset is not a codebase without modelling discipline.

## Inspection procedure

Four smells. **Closed list.** Primitive obsession is read as a sub-case of
`anaemic-model`, never a fifth smell. Run the language walk first — its term list
seeds vocabulary for the other three. Each smell's questions are MANDATORY per
applicable type/field/signature; the per-smell walk **is** the audit trail (no
script detects "anaemic model" — the recorded answers replace the script). Where
the substrate contains zero applicable material for a smell, say `examined=0`
explicitly; silent omission of a smell is itself a defect.

### Walk 0 — ubiquitous-language term list (run first)

Extract the domain term list from the spec substrate: read the spec's
concepts/domain/glossary sections (or, absent explicit sections, the recurring
nouns in user-story and acceptance prose), then the plan's vocabulary prose, then
every named entity/value-object in the data-model. Each entry: `<term> →
<one-line gloss> → <source: file §section>`, with plurals, verb forms, and
abbreviations folded into the head term. If the spec is silent on a concept that
nonetheless appears in the types, that is a separate "term not grounded in spec
text" observation for the synthesis pass, not a drift finding.

### Smell 1 — anaemic-model

A domain type is a data bag, separated from the rules that give it meaning. The type and its rules are one responsibility: its invariants, and the rules that decide its states and transitions. Splitting them across modules scatters that responsibility (low cohesion), makes the rules' module depend on the type's internals (high coupling), and means one change to the concept edits two modules (a single-responsibility breach). The re-checked invariant is the most visible symptom; rules living elsewhere is the same fault.

Per declared/diffed type, ask:

- **Is there an invariant on this type?** (a closed value set described in prose,
  an ordering relation between fields, a positivity or format constraint, a
  non-empty requirement.)
- **Where do this type's rules live?** In its own module, as an entity or value object (cohesive — good), or in a service, planner or repository decoder that switches on its fields (the concept is split — finding). The finding names the rules to move in, and the change that would otherwise have to edit both modules.
- **Where is the invariant checked?** At the construction / boundary-translation
  site (true-by-construction — good), or re-checked at every consumer (anaemic —
  finding). A stated invariant typed as a bare primitive with the check living in
  orchestrator code is the signature of this smell.
- **Could a smart constructor or a tighter input type make it
  true-by-construction?** This generalises beyond domain types: any *runtime
  guard* whose checked-for state a tighter **chokepoint input type** could render
  unconstructable is the same finding — the invariant belongs in the type, not the
  guard. If fixing the model deletes the guard, the finding is this lens's; name
  the compile-time bound that would carry it.
- **Primitive-obsession sub-case.** A boundary field typed as a primitive when an
  invariant, format, or unit attaches (a constrained id as a bare string, an
  amount-with-unit as a bare number, a validated-elsewhere value) is a missing
  value object — counted under anaemic-model.

A type with no behaviour of its own is not a concept of its own: it folds into the module of the concept that owns it, so the concept stays whole in one place. The one module that is types alone is a **port**, the dependency-inversion contract an outer layer implements. Its separation is the point, because it lets the outer layer depend on the contract without depending on the logic behind it. A port's module holds the port with its own failures and request types. A type-only module that is not a port is a finding under this smell.

### Smell 2 — foreign-model-mutation

A consumer reads, mutates, extends, or structurally derives from a type owned by
**another bounded context** (another package's domain, another aggregate's
interior, an adapter row shape used as a domain type) instead of consuming the
owning context's capability/port or translating at the boundary. Per
cross-context reference, ask:

- **Does this file import a type from another package, another service, or
  another aggregate's interior?** (cross-package, or same-package different
  domain root.)
- **What does the consumer do with it?** (a) consume the foreign context's
  port/operation (capability — fine); (b) translate the foreign type into a
  consumer-owned type at the boundary, then operate only on the owned type
  (boundary translation — fine); or (c) read its interior fields to make a
  decision, pass it through as-if-owned, extend it by intersection, spread it, or
  mutate its fields (foreign operation — finding).
- **Is there a type-escape symptom?** A suppression directive, an unsound cast, or
  a structural `Pick`/`Omit` of a *foreign* type's interior is a strong signal the
  consumer needed a translation point it never authored. The lint symptom is
  downstream; the modelling fault — the missing consumer-owned type — is this
  lens's finding.

An affirmative pattern is a kernel-shipped **base type** consumed via a generic
constraint (`<TCtx extends Base>`) — that is the published contract for
cross-context sharing, not interior reaching. Not a finding.

### Smell 3 — language-drift

The identifiers in the model don't match the ubiquitous-language terms in the
spec: same concept, two names, in the same layer; or spec text and type names
disagreeing. Per term in Walk 0's list, search the diff/model for usages and
classify each:

- **canonical** — the name is the term or a natural variant (plural, verb form,
  domain-prefixed compound). Not a finding.
- **synonym in same layer** — a different word for the same concept within one
  layer (domain with domain, transport with transport). Finding.
- **layer-natural synonym** — a different word that is the layer's natural
  vocabulary (a transport calling something "request", a kernel calling something
  "context"). Not a finding; record it in the trail so the count is honest. The
  test: *would a domain reviewer reading the transport recognise the concept?*
- **outright-wrong term** — the name refers to a *different* spec concept
  entirely. Finding, higher severity.

Hold the spec's spelling (British vs American) as the line; inconsistency at the
spelling level is still drift. When the spec under review **is itself** the
rename (introducing a new term that supersedes an old one), legacy uses outside
the rename's scope are real findings tagged "in flight per current spec" — they
signal the rename scope is undersized; the synthesis pass decides whether the
sweep must land in the same spec.

### Smell 4 — leaky-storage

A domain type carries storage concerns it shouldn't. Per declared/diffed domain
type, ask:

- **Does a field name mirror a database column or storage encoding?** (an
  epoch-suffixed timestamp, a `_json`/`_blob` field, a column-cased name.)
- **Is `id` typed as the storage's rowid primitive** rather than a branded id
  value object?
- **Does a nullable exist only because the schema allowed null** for a field the
  domain treats as required?
- **Does any `domain`/`application` file import from `adapters`/`infrastructure`
  or a driver library, with the imported type then used AS the domain type?** (the
  bare import is the layer lens's symptom; the type-used-as-domain is this lens's
  modelling fault.)
- **Does a repository return a row-shaped type instead of the aggregate?** The
  repository's contract is row-in, aggregate-out; a domain type that IS the row is
  the seam being violated. A row type confined to the adapter file is fine — only
  a row shape standing in for the aggregate is the finding.

### Type-import-graph inspection (mechanical aid for Smells 2 and 4)

The closest thing to a script this lens can lean on: walk every cross-module type
import plus the type-escape signals (suppression directives, unsound casts,
`Pick`/`Omit`) and label each row exactly once:

- **owned** — from a published base type (kernel base, port interface) or the
  consumer's own context. Not a finding.
- **boundary translation** — a foreign type imported to translate into a
  consumer-owned shape, after which only the owned shape is used. Not a finding.
- **foreign operation** — interior fields read, value mutated, type extended, or
  shape structurally derived. A foreign-model-mutation finding.

Resolution order per row: (1) identify the imported type's owning context —
published base or same-context → owned; an adapter/infrastructure import into
domain/application → leaky-storage finding; otherwise cross-context, continue;
(2) read how the consumer uses it — `extends`-parameterised or handed-on-at-a-port
→ owned/boundary; translated-then-owned-only → boundary; interior-read / extend /
spread / mutate → foreign operation. For each escape-hatch hit, ask whether the
targeted type is foreign — if so the modelling fault is this lens's and the lint
symptom belongs to the type-soundness lens; if consumer-owned, it isn't this
lens's finding at all. For each `Pick`/`Omit`, the type argument's owner decides:
foreign → foreign operation, consumer-owned → fine.

Hard rows: follow a **barrel re-export** to the actual owning file before
classifying (the owner's location decides context, not the barrel's); a **type
alias** to a foreign type does not change ownership — interior reads through the
alias are still foreign operations; a value received as opaque and immediately
parsed at the boundary into a consumer-owned type is correct translation, not a
finding.

## Letter-vs-intent

This lens's value lives in catching the fault **upstream of a passing symptom
check**: a model where every individual type looks reasonable yet an invariant is
prose-only, a foreign read that compiles cleanly because the consumer reached for
a cast, a name that is locally well-formed but disagrees with the spec. A finding
must always answer the discriminator — *would fixing the model make a named
downstream symptom impossible?* — and name that symptom. Vague phrasings ("the
model could be cleaner", "this feels anaemic") are the lens's own failure mode;
a finding with no concrete invariant, no foreign owner, no spec term, or no named
downstream symptom is not a finding.

A model can have no invariant re-checked anywhere and still be anaemic: if the concept's rules sit outside its type, ask what one change to the concept would have to edit.

This lens reads *carved-at-the-wrong-joint*, not *under-specified* (a stubbed or
vague signature belongs to a completeness checkpoint) and not function-shape
(classes, arity, loops are orthogonal). It signals re-modelling; it never edits
the model itself.

## Output shape

Produce the per-smell counts the dispatching agent mandates — every smell
reported, including any at `examined=0`:

```
ddd-modelling
Walked: declared/diffed types <N>, fields <M>, unions <U>, against <T> ubiquitous-language terms.
  anaemic-model:          examined=<X1> findings=<F1>
  foreign-model-mutation: examined=<X2> findings=<F2>
  language-drift:         examined=<X3> findings=<F3>
  leaky-storage:          examined=<X4> findings=<F4>
Type-import-graph: imports examined=<I>, cross-context candidates=<C>, confirmed foreign operations=<V>
```

Every finding is `file:line | quoted code | <constitution-clause-id | DDD principle> | defect-named`,
where the defect line states the modelling fault, the downstream symptom that
fixing the model would make impossible, and the proposed re-modelling (the value
object, closed union, or translation point that carries the meaning). State the
constitution path you resolved and which modelling clauses you anchored against.
A "no findings" result that did not walk every applicable type is a defect — the
walk is the audit trail, and an unwalked walk is an unrun script.
