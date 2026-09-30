---
lens: [di-discipline]
fuelled-by: code-discipline rules tagged `lens: di-discipline`
---

# DI-discipline lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: di-discipline`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, or library names; those live in the loaded rules and differ per
codebase.

## Concept

This lens defends **dependency injection through composition** on both faces of
the code: every technical binding a unit needs — wall-clock time, process and
signal lifecycle, standard-library capabilities (filesystem, crypto, path, net),
and third-party services — arrives through a named port the unit receives as a
constructor parameter or function argument, never reached for through a global,
an ambient import, or the module system. Each port ships a default factory in
its own module so production wires the real implementation once at the
composition root and tests inject a fake of the same shape. The test face is the
mirror image: a unit test fakes *everything* outside the unit's boundary, and it
delivers those fakes the same way production delivers the real ones — through the
unit's own signature — so the unit is byte-identical under test and under
production and never knows which it received. The moment a test reaches for the
module system to control a dependency (mock an import, stub a global,
monkey-patch a binding), the unit's DI is wrong: the dependency was not a port.

Across codebases the concept recurs under different names (constructor
injection, hexagonal ports-and-adapters, "no ambient singletons", "depend on
abstractions"). The loaded rules tell you this codebase's exact shape: which
capabilities are named ports, the single permitted site for each ambient
binding (the wrapping factory), the default-factory naming convention, any
type-level constraint on context-consuming middleware, and the closed list of
banned test-faking mechanisms. Read them first; they override any default
intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (usual cause: a detached worktree or fresh clone where the composed `.claude/` copy has not been written; re-resolve against the maintained `plugins/rin/knowledge/aidlc-shared/code-discipline/`), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value is
   `di-discipline`.
3. Read each kept rule in full, including its `## Carve-outs` / `## Examples`
   section. The carve-outs are the closed exception list — anything outside them
   is a finding. Where a rule names the single permitted site for an ambient
   binding (a factory file, a port-module directory), that is the *only*
   permitted site; everywhere else the same call is a violation.
4. If zero rules carry this lens tag, report that the codebase declares no
   DI discipline and produce an empty finding set — do not invent rules.

## Inspection procedure

This lens reads two faces and reports them separately: the **production side**
(are bindings ports, wired from defaults, threaded to the units that need them)
and the **test side** (are dependencies faked through the unit's own seam, or
reached for through the module system). Walk the diff for both.

### Production side

- **Ambient binding outside its permitted site.** For each capability the rules
  confine to a single factory (time construction, process/signal lifecycle, each
  standard-library module), find every direct call to the raw global or stdlib
  symbol. A hit inside the named factory module is the abstraction boundary —
  pass. A hit anywhere else is a violation: the unit must instead receive a port
  and call it. The raw symbols to grep are codebase knowledge — derive them from
  the rules' literal text (the constitution names them) and from the imports in
  the diff, not a fixed list.
- **Consumer-signature gap.** A function or factory that *produces* a value from
  an ambient capability (a timestamp, a unique id, a path join, a signal
  handler) but does NOT take the corresponding port as a parameter is a
  violation-in-waiting even if it currently delegates to a helper that itself
  holds the raw call. The composition pathway must terminate at an injected port,
  not at a buried global.
- **Missing default factory.** For every port type added or changed in the diff,
  confirm a sibling default-factory function exists in the same module (the
  production implementation). A port shipped without its default forces every
  consumer to hand-roll the wiring and predicts test-side module-mocking
  downstream — flag the absence preemptively. Conversely, consumers that
  construct an ad-hoc object literal matching the port shape outside test code,
  instead of importing the default factory, are reaching around the port.
- **Composition-root threading.** The boot path (the service-run entrypoint, the
  app start module, the kernel composition) must call each default factory and
  pass the port into the unit that declared it. A unit that *declares* a port
  parameter but is never wired to one in the boot path is a threading violation;
  a boot path that constructs a port inline instead of importing its factory is
  the same gap from the other end.
- **Type-level context constraint.** Where the rules require context-consuming
  middleware (or any generic that reads kernel-shipped context fields) to bind
  its context type to the base-context constraint, an unbounded generic that
  nonetheless reads those fields is a violation. The fix is the constraint, never
  a runtime guard or an optional/fallback option — the constraint is what makes
  pipeline composition provably correct at compile time. When such middleware
  also carries a raw-global fallback for the field it should read from context,
  that fallback is a separate ambient-binding finding on the same line.

### Test side

- **Module-system interception.** Every test-faking mechanism that reaches the
  module system rather than the unit's signature is a finding the instant it
  appears — no further analysis of test outcome, library lineage, or local
  ergonomics is needed. This covers module mocks, deferred module mocks, hoisted
  mock infrastructure, global stubs (and their cleanup), the jest-API
  equivalents, direct property assignment or property-descriptor patching on an
  imported binding, proxy wrappers around a real module, HTTP-interception
  libraries standing in for an injected client, and older rewire-style loaders.
  The remediation is always identical: lift the faked dependency into the unit's
  signature as a port, supply the production default at the composition root, and
  inject the fake directly in the test.
- **The spy edge case — discriminate by attachment target.** A spy is the one
  mechanism that requires per-call classification. A spy attached to a method on
  a fake the test itself constructed and passed through the unit's seam is
  *observation* — permitted; it reads interaction without replacing anything. A
  spy attached to a method on an imported module (replacing or even merely
  observing its real behaviour) is *module-system reach* — the same shape as a
  module mock, a violation. The discriminator is solely **what object the spy is
  attached to**: a DI-delivered fake (permitted) or an imported binding
  (violation).
- **Fakes that are permitted are not mocks.** A test that constructs an object
  literal, a factory-built fake, an in-memory implementation of a port, or a
  recording test-double function, and delivers it through the unit's constructor
  or argument, is the exact pattern the discipline channels toward — not a
  finding. "Mock" in common speech covers both shapes; the rules treat them as
  opposites. The affordance is the port's type; no library wraps it.
- **Boundary gap that forces a mock.** If a dependency the test needs to control
  is *not in the unit's signature*, that is a structural finding even before any
  mock appears: the unit needs a port added before DI-clean testing is possible.
  A test-only subclass overriding a method, or a test-only env/flag the unit
  reads to choose fake-vs-real, are both this gap surfacing — the fake should
  arrive through the seam, and (for the env/flag case) the unit must not know it
  is under test.

For each candidate on either side, decide finding vs non-finding strictly
against the loaded rules and their carve-outs — never against this file's prose
or a remembered version of some other codebase's rule. When a mechanism appears
that the rules' enumeration does not cover, surface it explicitly rather than
deciding it silently — extending the closed list is an amendment surface, not an
agent-time call.

## Letter-vs-intent

The lens's catch-rate lives where the code reads injected but a dependency still
arrives ambiently. A unit whose signature declares a port yet whose body holds a
raw global call on a "convenience" path; a default factory present but the boot
path constructing the port inline beside it; a middleware generic that compiles
because its context happens to carry the field, yet is unbound so a different
pipeline would crash; a spy that looks like clean observation but is attached to
an imported module; an in-memory fake that is actually wired through a module
mock rather than the seam. A finding here must explain *how the code reads
DI-clean yet the dependency is still reached for ambiently*, grounded in the
specific loaded rule. Vague phrasings ("tight coupling", "hard to test") are the
lens's own failure mode.

## Output shape

Report **two-sided** counts the dispatching agent mandates: a production-side
block (ambient-binding violations by capability, missing default factories,
threading gaps, unbound context generics) and a test-side block
(module-interception violations by mechanism, spy classifications, structural
boundary gaps). Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
the id its frontmatter declares, and — for a test-side mock — naming the port
shape the remediating refactor would lift into the unit's signature. State the
code-discipline path you resolved and which rule ids you loaded under this lens.
