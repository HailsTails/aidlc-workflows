---
lens: [type-soundness]
fuelled-by: code-discipline rules tagged `lens: type-soundness`
---

# Type-soundness lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: type-soundness`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, or library names; those live in the loaded rules and differ per
codebase.

## Concept

This lens defends **the integrity of the type system as a source of truth**: the
type the compiler sees must be the type the value actually has, and the type
must declare state rather than make the reader evaluate it. The unifying defect
is *lying to the type system* — telling the compiler something it cannot verify
and would otherwise reject. The lies take several forms:

- **Casts** — asserting a value is some type the compiler cannot confirm
  (`as`-style coercions, double-coercions through the top type, bottom-type
  assertions).
- **The absent type** — the escape-hatch top type that disables checking
  (`any`-style) and propagates that absence silently through every consumer.
- **Non-null assertions** — asserting presence the compiler cannot see.
- **Strict-flag overrides** — weakening the inherited compiler-strictness
  configuration so a whole package stops catching a class of error.
- **Return-type-of-own-symbol** — deriving a type via the language's
  "type of what this function returns" operator over a symbol the codebase
  itself authored, in place of the named export that already exists.
- **`default:` on a closed-union switch** — telling the compiler the
  discriminator "could be anything", masking the exhaustiveness failure the
  compiler would otherwise raise when a new variant lands.
- **Declarative booleans** — a `boolean`-typed field/parameter/return forces the
  reader to evaluate what `true` versus `false` means here, where a string-literal
  or discriminated union would declare the state directly at the type layer.

Across codebases the concept recurs under different names (a "no casts" rule, a
"no `any`" rule, "make illegal states unrepresentable", "parse, don't validate",
strict-compiler-config discipline). The loaded rules tell you this codebase's
exact shape: the closed list of permitted cast contexts and their exact sites,
which strict flags are inherited, the boolean carve-outs, and the
return-type carve-out. Read them first; they override any default intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (usual cause: a detached worktree or fresh clone where the composed `.claude/` copy has not been written; re-resolve against the maintained `plugins/rin/knowledge/aidlc-shared/code-discipline/`), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value contains
   `type-soundness`.
3. Read each kept rule in full, including its `## Carve-outs` section. The
   carve-outs are the closed exception list — anything outside them is a
   finding. Where a rule names exact permitted sites (file paths, cast shapes,
   predicate forms, flag names), those are the only permitted sites, and a
   site matching the *kind* but not the exact named location is still a finding.
4. If zero rules carry this lens tag, report that the codebase declares no
   type-soundness discipline and produce an empty finding set — do not invent
   rules.

## Inspection procedure

Walk every changed type-bearing source file, plus every compiler-config file in
the diff. For each construct the lens asks: does this assert to the compiler
something it cannot verify, or does it make the type stop declaring state?

- **Cast sites.** For every coercion (`as <T>`, double-coercion through the top
  type, bottom-type assertion, non-null assertion), check the file path and the
  cast *shape* against the closed list the rules declare. A cast is permitted
  only when BOTH the site (exact file) and the form match a listed context;
  either mismatch is a finding. "We're at a boundary" is not a justification —
  only the named boundaries qualify. Watch specifically for the
  collapse-keys-to-`string` standard-library constructor whose output a cast
  then re-narrows: the rules typically forbid it because the cast is either a
  soundness assertion or a width-narrow admitting drift.
- **The absent type.** Every occurrence of the escape-hatch top type in authored
  source is a candidate — bare, in generic positions (`Array<…>`,
  `Record<string, …>`, `Promise<…>`, `Map<…>`), and the implicit-widening form a
  `let` with no annotation acquires. A match inside a string literal or comment
  is not a finding. The rules typically grant this zero carve-outs; an inline
  suppression annotation records the escape but does not cure the underlying
  finding.
- **Strict-flag config.** For every per-package compiler-config file in the diff,
  check whether it sets any inherited strict flag to off, or omits/overrides one
  the base sets on, or weakens it transitively (a sub-flag turned off while the
  umbrella flag is inherited on). Either is a finding. The remediation is "remove
  the override and fix the type errors it was masking" — those masked errors are
  the load-bearing finding; the config line is only the surface.
- **Return-type-of-own-symbol.** For every "type of what this returns" operator
  over a `typeof`-referenced symbol, determine whether the symbol is authored in
  this codebase. If yes → finding (the named export already exists; use it). If
  the symbol is external AND the library exports the named return type → finding
  (use the named type). Only an external symbol whose library exports no named
  return type is the carve-out, and the report must cite the library and confirm
  the absence; unresolved uncertainty about origin is itself the finding.
- **`default:` on a closed-union switch.** For every switch, find the
  discriminator's static type. If it is a closed union (string-literal union,
  `{ kind: … }` discriminated union, or finite enum) AND the body carries a
  `default:` arm → finding. The function-first replacement is an
  exhaustiveness checkpoint at the fall-through position (a bottom-type
  assignment) so a future unmatched variant fails the build. A `default:` is
  legitimate only when the discriminator's source is genuinely *open* (a parsed
  external string, an untyped storage row) — in which case the open shape, not a
  closed-union `default:`, is the correct model.
- **Declarative booleans.** For every `boolean`-typed annotation — parameters at
  any depth (bare, destructured, nested in a parameter-object type), type/interface
  fields, return types, explicit variable-type annotations — check it against the
  closed boolean carve-out list (typically: a type-predicate/asserts return form;
  a single bridge line reading/writing an external library's mandated boolean with
  every surrounding type using a union; a local `const` consumed inline and never
  escaping). Anything else is a finding; remediation is always a string-literal or
  discriminated union. Note especially the *discriminator consequence*: a
  result/outcome shape that discriminates on a boolean field rather than a string
  field, and *port-output* booleans that re-contaminate every downstream consumer.

For each candidate, decide finding vs non-finding strictly against the loaded
rules and their carve-outs — never against this file's prose or a remembered
version of some other codebase's rule.

## Letter-vs-intent

The lens's catch-rate lives where the code type-checks cleanly yet the type is
defeated: a cast that compiles because it asserts away the very mismatch that
matters; a `default:` arm that keeps a switch compiling while hiding the
exhaustiveness check that would have flagged a new variant; a `boolean` field
that is syntactically fine but forces every reader to evaluate its meaning; a
strict-flag override that makes a whole package compile by *not* checking. A
suppression annotation pointing at a tracker records the escape but never cures
the finding — the underlying violation stays load-bearing, and the tracker must
point at the spec that *retires* the escape, not one that *excuses* it. A finding
here must explain *how the code reads correct yet the type is defeated*, grounded
in the specific loaded rule. Vague phrasings ("looks unsafe", "casting is bad")
are the lens's own failure mode.

## Output shape

Produce the counts the dispatching agent mandates (e.g. cast sites by
permitted/violation, absent-top-type occurrences, strict-flag overrides,
return-type-of-own-symbol sites, closed-union `default:` arms, declarative-boolean
sites by carve-out invoked). Record the compiler version / config you read where
the rules call for it. Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
the id its frontmatter declares; where a carve-out was invoked, state which one
and why it does not apply. State the code-discipline path you resolved and which
rule ids you loaded under this lens.
