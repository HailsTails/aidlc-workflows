---
lens: [function-first]
fuelled-by: code-discipline rules tagged `lens: function-first`
---

# Function-first lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: function-first`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, or library names; those live in the loaded rules and differ per
codebase.

## Concept

This lens defends **function-first composition**: the idea that behaviour is
expressed as functions and closures rather than authored classes, that iteration
is functional transformation rather than imperative loop shape, that third-party
libraries are reached only through a confined wrapping boundary, and that every
authored function takes a single named-field argument rather than a positional
list.

Four facets of the same stance:

- **No authored classes.** State and behaviour live in a factory that closes
  over its data and returns a record of functions. A `class` declaration hides
  state behind `this`; the closure makes the same state a private binding the
  type system never exposes. The single permitted authored class (and the only
  permitted `new X(...)` sites) are whatever the loaded rules name — typically a
  lone boot-time error class plus external-library instantiations confined to
  their wrapping factories.
- **Functional iteration only.** A loop body hides the transformation as
  control-flow; the equivalent `map`/`reduce`/`flatMap`/`Array.from` chain names
  the transformation as data. Counted loops name a counter where the operation
  is what matters. Side-effect-only iteration is the one place an imperative
  shape survives, and even then under a `void`-returning callback.
- **Third-party imports confined to wrapping factories.** A library is an
  external dependency the domain should not see directly. Each library is
  imported in exactly one wrapping-factory file (runtime *and* type-only); every
  other module consumes the kernel-supplied factory output. The wrapping factory
  *is* the function-first boundary for the library — it is where the unavoidable
  `new X(...)` and the raw import are quarantined behind a function-shaped
  surface.
- **Single-object-argument functions.** Every authored function takes exactly
  one parameter; multiple values pass as named fields on an object. Positional
  multi-argument signatures are forbidden except for callbacks whose signature is
  dictated by an external-library contract — and those hand off to a named-field
  helper at the earliest line.

Across codebases the concept recurs under different names (a "no classes" rule, a
"prefer pipelines over loops" rule, an "adapter boundary" or "ports and
adapters" rule, a "named parameters" or "options object" rule). The loaded rules
tell you this codebase's exact shape: which class is permitted and where, the
closed list of wrapping-factory files, the permitted iteration alternatives, and
the closed carve-out for positional callbacks. Read them first; they override any
default intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (ensure the pinned plugin installation and its `{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/` directory are present in the review worktree), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value contains
   `function-first`.
3. Read each kept rule in full, including its `## Carve-outs` section. The
   carve-outs are the closed exception list — anything outside them is a
   finding. Where a rule names exact permitted sites (the one permitted class and
   its file, the closed table of wrapping-factory files, the closed list of
   library-callback signatures), those are the only permitted sites.
4. If zero rules carry this lens tag, report that the codebase declares no
   function-first discipline and produce an empty finding set — do not invent
   rules.

## Inspection procedure

Walk the changed source files (the rules' own carve-outs say whether test files
are in scope; default the class/iteration/arity passes to non-test `src/` unless
a rule states otherwise). Run four passes; each is a single mechanical sweep
followed by a per-site classification.

### Class pass

Every `class` declaration in scope — exported or not, since the discipline is
per-declaration not per-export — is suspect until classified. For each, decide
one of three buckets:

- **justified.** The declaration is the single permitted authored class at its
  named site, OR it is a `new X(...)` for an external-library class whose
  wrapping-factory file the rules name AND the instance is held inside the
  closure and never re-exported as a class. Cite the carve-out; no replacement.
- **closure-candidate.** The class carries genuine instance state that is
  *mutated* across method calls (counters, caches, accumulating buffers,
  subscription registries, in-flight tracking). Replacement: a factory closing
  over `let`/`const` bindings, returning a record of functions; the state is
  invisible to consumers and typed by the returned record. *Mutation is the
  discriminator for this bucket.*
- **pure-fn-candidate.** Every method only reads a readonly stash (config held
  on `this`) without mutation, or operates solely on its own arguments — the
  class is a namespace with a constructor. Replacement: lift each method to a
  module-level function taking the previously-`this` data as a named-field
  argument; the constructor was a deferred first argument and usually collapses
  entirely.

Hard heuristic when borderline: **if removing `this` from every method body
leaves the bodies readable, it's pure-fn; if `this` carries state that genuinely
advances between calls and is private to the surface, it's closure.** Try the
substitution mentally; the bucket falls out. If neither test applies cleanly —
the class is doing several things at once (mutable state *and* derived config
reads *and* a state-machine identity that arguably deserves its own aggregate) —
do not invent a fourth bucket and do not pick the closest fit. Surface it as
`rubric-resistant` and note that a modelling/decomposition lens likely needs to
split it before this lens can classify the pieces. Single-lens dispatch means
this lens surfaces ambiguity rather than resolving it.

**Closure-candidate that holds context-supplied ports.** When a closure-candidate
holds port references that the codebase already threads through a shared context
object (a clock, a logger, a correlation id, or any port carried on the
composition-side context type), the right rewrite is not "inject the ports
through the factory" — it is a closure that *binds the context generic* so the
ports come from context. If the codebase has a rule constraining the
composition-side generic to extend a context base type, name it as the companion
citation for this case (the rewrite is "make it a closure that binds the context
generic", not merely "make it a closure"). That generic-binding rule is owned by
another lens — cite it as a cross-reference, do not claim it as this lens's. Port
state that is *not* carried on the shared context (a domain-specific adapter)
instead goes through an explicit factory closing over those bindings — the plain
closure-candidate rewrite.

### Iteration pass

Every imperative loop site in scope is a candidate. Classify the body and name
the composition replacement:

- **Pure transformation** (the body builds a result from each element) →
  `map`/`reduce`/`flatMap`/`filter`/`Array.from`.
- **Sequential async with order dependence** → a `reduce` over a Promise chain.
- **Counted production** (the body emits a value per index) →
  `Array.from({ length }, (_, index) => makeValue(index))`; if it folds into an
  accumulator, chain that with `reduce`.
- **Side-effect-only** (logging, registering listeners, emitting events) →
  `forEach` whose callback explicitly returns `void` and never `return`s a value.

A counted loop that merely indexes into an array (`items[index]`) is a disguised
element-iteration loop — replace as a transformation, not as a counted
production. A decrement loop is still a counted-loop finding; the rule covers
counter-shaped `for`, not a direction. An async-iterator loop has no source-side
carve-out unless the rules grant one — lift it into a Promise-reduce pipeline or
an event `forEach` handler by shape.

### Wrapping-factory pass

Every raw third-party import (runtime *or* type-only) and every `new X(...)` for
an external-library class is a candidate. For each: is the importing/instantiating
file on the rules' closed list of wrapping-factory files for that library? If
yes → justified. If the library is on the list but the file is not, the import is
in the wrong place — a function-first finding with a DI/port cross-reference (the
raw import escaping its wrapping factory is both a structural and a
boundary-discipline defect; name the boundary lens as the cross-reference). A
`new X(...)` for a class the codebase itself authored is a finding twice over —
the class should not have been authored, and the instantiation is the symptom.

### Arity pass

Every authored function with two or more parameters is a candidate — and the
direct sweep is load-bearing because any lint backstop for parameter count is
typically configured looser than the rule's intent of exactly one. For each: is
it a callback whose signature is fixed by an external-library contract in the
rules' closed carve-out list (array-method callbacks, the test framework's
`test`/`describe`, JS event handlers, the HTTP-framework handler signature)? If
yes → pass, and confirm the body hands off to a named-field helper at the
earliest line. Otherwise → finding; the replacement collapses the positional list
into one named-field object. A lint-suppression annotation placed on a multi-arg
authored signature to silence the parameter-count check is itself a finding — the
suppression is masking the rule.

For each candidate across all four passes, decide finding vs non-finding strictly
against the loaded rules and their carve-outs — never against this file's prose or
a remembered version of some other codebase's rule.

## Letter-vs-intent

The lens's catch-rate lives where the surface reads innocent but the stance is
defeated: a counted `for` that is really element iteration in disguise; a
"namespace" class that is a pure-fn-candidate dressed as an object; a closure
that re-injects ports the context already carries instead of binding the context
generic; a type-only import of a raw library that slips past a runtime-only
import scan; a lint-suppression that converts a multi-arg signature from a finding
into apparent compliance. A finding here must explain *how the surface reads
acceptable yet the rule is defeated*, grounded in the specific loaded rule. Vague
phrasings ("this could be more functional", "feels imperative") are the lens's own
failure mode — every finding commits to a bucket or a named replacement.

## Output shape

Produce the counts the dispatching agent mandates across all four axes — class
declarations by classification (justified / closure-candidate / pure-fn-candidate
/ rubric-resistant), imperative-loop sites by kind (element-iteration vs counted),
raw-library-import and `new X(...)` sites by in-factory vs out-of-factory, and
multi-argument authored signatures by carve-out vs finding. Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
the id its frontmatter declares, plus the bucket or the named-field/composition
replacement. Where a finding touches another lens's rule (the context-generic
binding, the port/boundary discipline), name that as a cross-reference — do not
re-tag or re-own it. State the code-discipline path you resolved and which rule
ids you loaded under this lens.
