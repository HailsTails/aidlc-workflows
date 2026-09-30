---
lens: [decomposition]
fuelled-by: code-discipline rules tagged `lens: decomposition`
---

# Decomposition lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: decomposition`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, threshold numbers, or tool rule names; those live in the loaded
rules and differ per codebase.

## Concept

This lens audits **shape, not content** — it asks whether a unit is doing more
than its altitude warrants. It defends three related ideas:

- **Orchestrator purity.** A module classified as an orchestrator composes
  helper calls in dependency order and assembles a return value, and nothing
  else. Inline branching beyond what a helper's return value already
  discriminates, loops, anonymous transformations, local helper definitions, and
  inline computation that carries meaning beyond plumbing are all work that
  belongs in a named helper — not in the orchestrator body.
- **Unhappy-path early return.** When a branch distinguishes a normal
  continue-path from an exceptional abort-path, the abort case returns early and
  the happy path is the function's final expression. The inverse shape
  (happy-first, failure-last) inverts the natural "compute X unless something
  went wrong" reading.
- **No parameter-field mutation.** A function inspects the parameters it
  receives and returns outputs; it never mutates the fields of those parameters
  — not by assignment, not by `delete`, not by a mutating method call. Locals
  constructed inside the body are not parameters and may be mutated freely before
  return; the contract is enforced at the input/output boundary.

Across codebases the concept recurs under different names (a complexity ceiling,
a "small functions" rule, a guard-clause / early-exit convention, an
immutability or no-side-effect-on-args rule). The loaded rules tell you this
codebase's exact shape: which module class counts as an orchestrator, the
closed carve-outs to the early-return rule, and what mutation forms are
forbidden. Read them first; they override any default intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (usual cause: a detached worktree or fresh clone where the composed `.claude/` copy has not been written; re-resolve against the maintained `plugins/rin/knowledge/aidlc-shared/code-discipline/`), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` list contains
   `decomposition`.
3. Read each kept rule in full, including any `## Carve-outs` section. The
   carve-outs are the closed exception list — anything outside them is a
   finding. Where a rule names a deterministic enforcer (a lint rule, an audit
   script) in its `enforced-by` frontmatter, treat that as a partial mechanical
   floor: the enforcer catches the obvious cases, but the structural read on
   diff-touched functions is the lens's job and is not mechanically covered.
4. If zero rules carry this lens tag, report that the codebase declares no
   decomposition discipline and produce an empty finding set — do not invent
   rules or thresholds.

## Inspection procedure

Walk every diff-touched function and the module it sits in. The lens reads the
*shape* of each body against what its altitude permits.

### Orchestrator purity

First decide whether the module is an orchestrator per the loaded rule's
definition (a composition root that wires helpers). If it is, the only permitted
body content is helper-call bindings, helper invocations in dependency order, and
a single return-value assembly. The tells, in order of frequency:

1. An `if` inside an orchestrator body whose then-branch is more than a few
   lines — the branch is doing work, and that work should be a helper named for
   the work.
2. A loop or a collection-transform callback containing anything beyond a
   one-line projection — the collection processing belongs in a helper named for
   the transformation.
3. A binding whose right-hand side is computation rather than a helper call.
   Plumbing literals (assembling a config/info object out of already-computed
   values) are fine; a derived value (an arithmetic or transform with standalone
   meaning) is extraction-worthy.
4. A local helper function declared inside the orchestrator body — extract to a
   sibling file with its own co-located test.

### Complexity and length signals

A long body or a deeply-branched body is the signal that an orchestrator (or any
function) is doing non-orchestration work. Where the loaded rules name a
mechanical complexity/length enforcer, a diff function over that ceiling is the
first place to look — but the **finding is the structural one** (this body
conflates abstractions / hides a helper), not the raw number. Conversely, some
files carry a recorded exemption from the mechanical ceiling (a composition root,
library-wrapping factories, tooling, test bodies). For an exempt file the lens
does **not** raise the raw length/complexity finding, but it MUST check whether
the recorded justification still holds — an exemption whose stated reason no
longer applies (the helper was extracted, the code migrated) is itself a finding.
Any inline suppression of the mechanical enforcer must carry the codebase's
required tracker reference; a bare suppression is a finding in its own count.

### Unhappy-path early return

For each diff function whose body contains an `if`/`else` over a success/failure
discriminator, apply the loaded rule's test: does this branch mean "everything
is fine, proceed" versus "abort — something is wrong"? If yes, the abort branch
must come first and the happy path must be the final expression. The fix is
almost always "invert the branch" — surface the corrected shape inline; do not
propose helper extraction for an early-return finding alone (that is an
orchestrator-purity concern that may co-occur, raised separately).

### Parameter-field mutation

For each diff function, check whether any field of a *parameter* is mutated:
direct assignment (`param.x = y`, `param[key] = z`), `delete param.field`, or a
mutating method call on the parameter (`param.push(...)`, `param.sort()`, and the
other in-place array/object mutators the loaded rule enumerates). Reassigning the
parameter binding itself is usually covered by a separate mechanical enforcer;
this lens closes the field-mutation loophole that enforcer leaves open. Locals
built inside the body are exempt. Where the loaded rule names an audit script as
the source-of-truth for direct assignment, seed findings from that report scoped
to diff files, and mark method-call mutations found by structural read as a
distinct category (the audit may not yet cover them) so synthesis does not
conflate script-confirmed with code-review findings. The fix is "copy-then-
mutate" (return `{ ...param, x: next }`) or the non-mutating method equivalent.

### When a finding recommends extraction

A suggested split must answer, in one sentence each: (1) what abstraction the
extracted helper contains — a noun phrase the file is named for, never a
categorical name; if you cannot name the abstraction, the body conflates more
than one and *that* is the finding, with no split proposed; (2) where the helper
file sits — same directory as the caller, named for the abstraction, not under a
categorical folder; (3) the helper's input/output shape in one line, honouring
the codebase's argument and failure-envelope conventions — you draft only the
boundary, never the body, test, or implementation; (4) what the caller becomes
after extraction (a single helper-call binding / an early return whose helper
returns the happy value / a caller that binds a copy instead of mutating). If the
post-extraction caller is still over the ceiling, the finding is "multiple
extractions required" and you enumerate them. Do **not** propose: an extraction
purely for line count with no abstraction; a single arithmetic expression with no
standalone meaning; a closure capturing more than a couple of caller locals (that
is a closure-state-injection problem — surface it as an upstream signal); an
extraction that crosses a layer boundary or requires a new injected port (those
are other lenses' lanes). When any anti-case applies, raise the upstream-problem
signal instead of filing a half-designed split.

For each candidate, decide finding vs non-finding strictly against the loaded
rules and their carve-outs — never against this file's prose or a remembered
version of some other codebase's thresholds.

## Letter-vs-intent

The lens's catch-rate lives where the mechanical floor passes but the shape is
wrong: a body under the complexity ceiling that still conflates two abstractions;
an early-return inversion that lints clean; a parameter mutation the audit
script's v1 cut does not yet detect; an exemption whose recorded justification
has silently expired. A finding here must explain *how the shape reads acceptable
yet the rule is defeated*, grounded in the specific loaded rule. Distinguish a
genuine carve-out (closed-discriminator peer dispatch, retry-loop exit condition)
from a real inversion — the carve-out branches are peer cases with no
happy/unhappy asymmetry, not findings. Vague phrasings ("function is too long",
"this looks complex") are the lens's own failure mode.

## Output shape

Produce the counts the dispatching agent mandates: files inspected, functions
inspected, complexity/length ceilings crossed by type, orchestrator-purity
violations, early-return inversions, parameter-mutation findings (split by
script-confirmed vs code-review category), and untracked suppressions. Every
finding is `file:line | quoted code | <rule-id> | defect-named`, citing the
loaded rule by the id its frontmatter declares, and — where extraction is
recommended — the suggested split per the four questions above. State the
code-discipline path you resolved and which rule ids you loaded under this lens.
