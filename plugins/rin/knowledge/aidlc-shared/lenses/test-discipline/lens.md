---
lens: [test-discipline]
fuelled-by: code-discipline rules tagged `lens: test-discipline`
---

# Test-discipline lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: test-discipline`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, or library names; those live in the loaded rules and differ per
codebase.

## Concept

This lens defends **structural test discipline** as a load-bearing floor — the
shape of the test suite, not the truth of any domain assertion. Six strands
recur across codebases under different names:

- **Co-location + every-file floor.** Each authored unit ships with a test next
  to it. The floor is binary (a sibling exists or it does not) and is the real
  coverage guarantee — distinct from, and preferred over, any numeric coverage
  threshold.
- **Zero-everything tests.** A test body is a straight line: arrange → act →
  assert. No control flow, no loops, no branches, no mutated capture, no
  unpredictability. N cases means N tests. Uniform cases, such as the rows of a table, are one parameterised test over the rows (the framework's `each`), never a loop inside a test body, and never one hand-written test per row. Variability is supplied by injected fakes, never computed inside the test.
- **Assert only the unit's own responsibility.** A test inspects what its unit
  produces and how it calls its collaborators — never the internal logic of a
  delegate reached transitively.
- **Pyramid scope.** Many isolated unit tests at the base; a thin band of
  composition tests with real backings in the middle; a smoke layer at the top.
  Composition tests are the minimum, not the bulk, and catch *only* composition
  bugs — a unit-localisable bug surfacing there means a unit test is missing.
- **The test's act.** The single line that invokes the subject-under-test must
  invoke *our* code. A test whose act is a third-party library call, with no
  authored code between act and assertion, tests the library, not the unit.
- **A test earns its place.** Each test is one complete behavioural case of the unit, with a reason to exist. A test that restates what the compiler or a dependency already guarantees tests nothing of ours: a declaration's shape pinned at type level, a constant compared with itself, a dependency's own constraint re-asserted. The one type-level assertion that earns its place guards a published external contract that a runtime comparison cannot see.

The loaded rules tell you this codebase's exact shape: the sibling-naming
convention, the closed list of banned test-body constructs, the matcher idioms,
and which backings count as "real" at the integration layer. Read them first;
they override any default intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (ensure the pinned plugin installation and its `{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/` directory are present in the review worktree), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value is
   `test-discipline`.
3. Read each kept rule in full, including any `## Carve-outs` or in-body
   exception clause. The carve-outs are the closed exception list — anything
   outside them is a finding. If a rule names exact allowed constructs, idioms,
   or excluded file kinds, those are the only ones permitted.
4. If zero rules carry this lens tag, report that the codebase declares no
   test-discipline rules and produce an empty finding set — do not invent rules.

## Inspection procedure

Walk the test files and the authored files in the diff. The strands below are
the generic detection insight; each maps to a loaded rule, which you cite by the
id its frontmatter declares.

### Sibling floor

Enumerate the authored production files in the diff (the loaded rule defines the
in-scope set — typically source files, with re-export barrels, type-only
declaration files, and generator-marked files excluded). For each, confirm a
co-located test sibling exists with the *exact* naming the rule mandates. Common
non-compliant shapes: a different test suffix, a test parked under a
forbidden test directory, an extension mismatch against its unit, or one
directory-level test standing in for many per-file units. A missing or
mis-named sibling is a finding. If the codebase ships an audit that already
emits a co-location section, seed findings from it rather than re-deriving by
hand.

### Zero-everything test bodies

Scan every test-body source for the constructs the rule bans (typically `if`,
`try`/`catch`, ternary, short-circuit side-effect gating, `throw`, loops or
iteration over assertions, and reassigned-binding capture). Each match is a
finding citing the construct. Know the rule's *allowed* patterns so you do not
false-positive: an inline narrowing assertion that the rule blesses is not a
branch; full-envelope matchers replace try/catch around thrown errors; `const`
destructuring with defaults is not a branch; data fixtures living outside the
test-file source are out of scope. The fix for a banned construct is almost
always "split into N linear tests" or "use the matcher the framework already
provides" — name that in the finding.

### Vague-matcher-as-implicit-branch

The rule on zero-everything bans branches; a loose matcher over a *structured*
value is a branch in disguise ("anything truthy passes" is the shape of
`if (value) pass`). For every assertion on a value that has shape, ask: **what
would this matcher accept that the precise matcher would reject?** A truthy/
falsy/defined/not-null check over an envelope, object, array, or tuple accepts
malformed shapes the unit should never produce — that is a finding; replace with
a full-envelope equality or structural match against the exact expected value. A
bare call-occurrence assertion where the call *arguments* carry the unit's
correctness is the same defect on a fake — replace with an exact-argument match.
If the honest answer to "what would it accept that it shouldn't?" is "nothing
meaningful" (e.g. a boolean-returning predicate asserted with a boolean literal),
the matcher is not vague. The lens is not "always demand the strictest matcher";
it is "do not accept assertions that lose shape on values that have shape".

### Delegation leak

A test must assert the unit's own output and the *call shape* it makes on its
collaborators — never the internal result of a delegate. Flag assertions that
reach into a fake's configured return value (asserting on what arrange already
set), that drill into a delegate's nested return shape, that exercise a partial
fake which itself runs real delegate logic, or that assert a value the unit
merely passed through from a fake. The wanted shape is an exact-argument call
assertion on the fake plus an equality on the unit's *own* computed output.

### Pyramid mis-scope

Check each test sits at the right layer. **Mis-scoped down:** an integration-
suffixed test built entirely from fakes (a unit test wearing the wrong suffix),
or one that spins up a real backing the unit never touches (decorative
ceremony) — move it to the unit layer. **Mis-scoped up:** a unit-suffixed test
that wires several units together with no fakes between them and asserts on the
cross-unit output — that belongs at the integration layer; the unit layer should
fake each cross-boundary collaborator. **Missing-unit signal:** an integration
test failing on a bug localisable to one unit's body — the bug should have failed
a unit test first; the finding is the missing unit test, not the integration
test.

### Test-act subject

For each test, name its **act** — the call whose result the assertions inspect —
and identify the act's callee owner. If the callee is a third-party library
function (a codec call, a bare schema parse, a library constructor) and **no code
we authored sits between the act and the assertion**, the test exercises the
*library*, not the unit. It satisfies the letter of "a test exists" while testing
a file we do not author, and it re-asserts a guarantee the dependency's own suite
already owns. This is a finding. Name where the invariant belongs instead — the
usual answer is a **compile-time bound** upstream (a parameter type that makes the
property true-by-construction, which deletes the test), not another assertion. If
authored code *does* transform the result before the assertion, the library call
is mere fixture setup and the test exercises our transform — not a finding.

### Test value

For each test, state the behavioural case it proves in one line. If the case is a declaration's type, a constant's own value, or a guarantee the compiler or a dependency already enforces, the test has no value: a finding, fixed by deleting it. If several hand-written tests differ only in their inputs and expected values, they are one case written N times: a finding, fixed by one parameterised test over the rows.

For each candidate across all strands, decide finding vs non-finding strictly
against the loaded rules and their carve-outs — never against this file's prose
or a remembered version of some other codebase's rule.

## Letter-vs-intent

The lens's catch-rate lives in tests that read clean but defeat the rule's
intent. A test whose constructs and matchers are spotless can still test nothing
of ours — only naming its **act** reveals it exercises a library. A matcher that
is technically valid (`toBeTruthy`) can implicitly branch over a structured
value, accepting shapes the unit must never emit. An integration test can wear
the right suffix yet assert a pure-unit property with no real backing in play. A
finding here must explain *how the test reads correct yet the rule is defeated*,
grounded in the specific loaded rule — and, for an act or pyramid finding, name
where the invariant or the test belongs instead. Vague phrasings ("test looks
weak", "could be better") are the lens's own failure mode. The act-check in
particular is detective, not generative: state it explicitly per test, because a
tautological-act test can reach a merge candidate while passing every
construct-and-matcher check.

## Output shape

Produce the counts the dispatching agent mandates (e.g. production files
inspected, siblings present vs missing, test files inspected, zero-logic
construct violations, vague-matcher assertions, delegation leaks, mis-scoped
tests by direction, tautological-act tests, valueless tests, uniform cases written out by hand). Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
the id its frontmatter declares, and — for a mis-scope, delegation, or act
finding — naming what fixes it (the layer to move to, the call-shape assertion
to use, or the upstream bound that deletes the test). State the code-discipline
path you resolved and which rule ids you loaded under this lens.
