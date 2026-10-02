---
lens: [errors-as-data]
fuelled-by: code-discipline rules tagged `lens: errors-as-data`
---

# Errors-as-data lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: errors-as-data`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, or library names; those live in the loaded rules and differ per
codebase.

## Concept

This lens defends **error totality and throw discipline**: the idea that a
fallible operation declares its failure modes in its return type rather than
escaping through exceptions, and that exceptions are confined to a closed,
named set of contexts. The signature is the contract — a function that returns
a result-envelope type must enumerate, inside that type, every way its body can
fail. A throw that escapes a result-returning function silently breaks the
contract even though the signature still reads correct.

Across codebases the concept recurs under different names (a `Result`/`Either`
envelope, a tagged error union, a "no unchecked exceptions" rule). The loaded
rules tell you this codebase's exact shape: the envelope's discriminator, the
permitted throw contexts, whether error envelopes are data or classes, and the
construction/inspection idiom. Read them first; they override any default
intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (ensure the pinned plugin installation and its `{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/` directory are present in the review worktree), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value is
   `errors-as-data`.
3. Read each kept rule in full, including its `## Carve-outs` section. The
   carve-outs are the closed exception list — anything outside them is a
   finding. If a rule names exact permitted sites (files, factory names, class
   names), those are the only permitted sites.
4. If zero rules carry this lens tag, report that the codebase declares no
   errors-as-data discipline and produce an empty finding set — do not invent
   rules.

## Inspection procedure

Walk every signature/implementation pair in the diff. For each, the lens reads
the type against the body and asks where the body can defeat what the type
promises:

- **Escape via uncaught throw.** A function whose return type is the codebase's
  failure-envelope shape, whose body `await`s or calls something that can throw
  without catching and converting at the boundary, can escape the envelope. The
  throw makes the signature a lie. (Which library calls throw is codebase
  knowledge — derive it from the dependencies in the diff, not a fixed list.)
- **Under-enumerated failure type.** List every distinct way the body produces a
  failure. Compare to the variants the envelope's error parameter enumerates. A
  body that distinguishes failures the type collapses into one opaque variant —
  or an error parameter that is the language's top/opaque error type rather than
  a closed union — defeats totality. The discriminator over the error type is
  the proof the type carries the failure modes.
- **Throw outside the permitted contexts.** Every throw site in non-throw-exempt
  code must match one of the closed throw contexts the rules name. A throw that
  reads as "defensive", "impossible state", or "this should never happen" is the
  pattern the discipline forbids unless it sits in exactly a named context (e.g.
  a genuinely type-unreachable exhaustion arm, or a named boot path) — and both
  the context AND its preconditions (return type, reachability) must hold.
- **Error envelope authored as a class.** If the rules require error envelopes to
  be plain data constructed by factory and inspected by type guard, an authored
  error class (or a class extending the language's base error type) is a finding
  except for the single class the rules explicitly permit, at its named site.
- **Discriminator / factory drift.** If the rules fix the envelope's
  discriminator field and its construction factory names, flag accesses or
  literals that use a superseded shape (an old boolean discriminator, a
  hand-rolled lookalike, pre-migration factory names).

For each candidate, decide finding vs non-finding strictly against the loaded
rules and their carve-outs — never against this file's prose or a remembered
version of some other codebase's rule.

## Letter-vs-intent

The lens's catch-rate lives in cases where the type reads correct but the rule
is defeated: a `Result`-typed function that can throw; an error parameter typed
as a closed union that nonetheless omits a failure mode the body produces; an
"unreachable" throw in a function that does not actually return the bottom type.
A finding here must explain *how the signature reads correct yet the rule is
defeated*, grounded in the specific loaded rule. Vague phrasings ("could throw",
"error handling looks weak") are the lens's own failure mode.

## Output shape

Produce the counts the dispatching agent mandates (e.g. throws by
classification, authored-error-classes by classification, under-enumerated error
types, superseded-discriminator accesses). Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
the id its frontmatter declares. State the code-discipline path you resolved and
which rule ids you loaded under this lens.
