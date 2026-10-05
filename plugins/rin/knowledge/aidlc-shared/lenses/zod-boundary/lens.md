---
lens: [zod-boundary]
fuelled-by: code-discipline rules tagged `lens: zod-boundary`
---

# Zod-boundary lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: zod-boundary`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection
procedure, and the output shape. It names no specific rule numbers, file paths,
type names, or library names; those live in the loaded rules and differ per
codebase.

## Concept

This lens defends **boundary validation discipline**: external, typeless input
is validated exactly once, at the seam where it enters the system, then mapped
to a plain internal shape that the rest of the code trusts by construction. The
validation library lives only at that seam — never leaking inward into the
application or domain layers. Two halves, one rule:

- **At the boundary, validate** — every crossing where input arrives from
  outside the system's type guarantees (a transport payload, an
  external-system adapter input, a config/env read, a file/DB driver row, a
  typeless library return) must run its input through a schema parse before any
  internal code touches it. "Trust the caller" for external input is the
  failure.
- **Inside the boundary, don't** — once parsed, the shape is plain, statically
  typed, and trusted. Re-validating it internally is redundant cost and a
  category error: it reads the boundary as "anywhere untrusted data might be"
  rather than "the single seam where external typeless input enters". A schema
  import inside an inner layer is the symptom.

Across codebases the concept recurs under different names (a Zod/io-ts/valibot
parse-at-the-edge, a "parse, don't validate" DTO mapping, a schema-at-the-port
rule). The loaded rules tell you this codebase's exact shape: which validation
library, the closed list of boundary-only sites, and which inner layers forbid
the library. Read them first; they override any default intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (ensure the pinned plugin installation and its `{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/` directory are present in the review worktree), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value is
   `zod-boundary`.
3. Read each kept rule in full, including its carve-outs. The carve-outs are the
   closed exception list — anything outside them is a finding. If a rule names
   the exact closed list of boundary-only sites, those are the only places the
   validation library may run; if it names the inner layers where the library is
   forbidden, those are the only places a schema import is an automatic finding.
4. If zero rules carry this lens tag, report that the codebase declares no
   boundary-validation discipline and produce an empty finding set — do not
   invent rules.

## Inspection procedure

Two passes: walk the boundaries (is validation present?), then walk the inner
layers (is the library absent?).

### Boundary inventory walk

First enumerate the boundaries in the diff. A boundary is **the seam where
typeless external input enters the system**. The loaded rules name the closed
list; the recurring categories are:

- **Transport handlers** — the body of any handler whose input is wire-shaped
  (JSON over HTTP, an RPC/tool payload, an IPC message). The parse sits at the
  handler body's entry, before any orchestration.
- **Adapter inputs from external systems** — anywhere an adapter receives a
  payload from a system the codebase does not control (third-party APIs,
  webhooks, subprocess stdout interpreted as data, message-bus reads).
- **Config / env readers** — the single factory that owns the config schema.
  Config is a *capability*; the environment is merely the substrate it reads
  from. An inline environment read outside that factory bypasses the seam and is
  a finding.
- **File / DB driver row contracts** — driver row returns are typeless; the
  driver wrapping factory must parse each row through a schema before handing
  typed rows upward. File reads (frontmatter parses, JSON files, raw text
  interpreted as data) are the same shape.
- **Library wrapping factories that bridge typeless returns** — any library
  whose published types are the language's top/opaque type, a wide
  string-keyed record, or an over-wide supplied type the code must narrow. The
  wrapping file is both the closed import site for that library *and* the
  validation gate.

What is **not** a boundary: inter-module calls inside the same app;
helper-to-helper composition inside an orchestrator; test fixtures; and any data
already parsed at a boundary and propagated inward through fully static types.

For each boundary in the diff, ask the two questions:

1. **Is the typeless input parsed by a schema before any internal code uses
   it?** Trace from the point input arrives to the first internal consumer. A
   schema parse must sit on that path.
2. **Does the parse produce the plain internal shape that flows inward** — not a
   re-export of the raw library type?

### The cast equivalence (cross-reference, do not own)

The **missing-schema-at-a-boundary** case usually surfaces as a different
lens's finding, and recognising the equivalence is this lens's sharpest
heuristic. When typeless input crosses a boundary without a schema, it has no
typed surface, so the code must **cast** to type it — an `as`, an
`as unknown as`, or an inline type annotation on a destructure (a cast in
disguise). That cast is owned by the type-soundness lens, not this one. But the
cast *is* the missing schema: a reviewer reading the boundary rule in isolation
hunts "is there a schema somewhere"; a reviewer reading the cast rule in
isolation hunts "is there a cast that shouldn't be"; each misses half. Read both
at once. When you see a cast in a boundary file, name it as the **observable
symptom** of the missing schema (cite this lens's boundary rule for the missing
schema; note the cast is the type-soundness lens's finding — do not re-tag or
claim the cast rule yourself). The four recurring symptom shapes:

- **Bare parse-then-assert** — a raw deserialization (`JSON.parse` and kin)
  whose result is assigned a type by annotation or `as` instead of handed to a
  schema's parse.
- **Face-value library return** — a library return typed `unknown`/`any`/wide
  record consumed via a hand-written inline annotation on the elements instead
  of a per-row/per-item schema parse.
- **Environment read outside the config factory** — any direct environment
  access outside the file that owns the config schema.
- **Cast as schema substitute** — a transport/adapter/wrapping-factory input
  cast directly to its expected shape. The cast asserts the shape; the
  boundary's job is to *verify* it.

### Internal-import walk

Then walk the inner layers the rules name as schema-forbidden (the application
and domain layers, by whatever path segments the codebase uses — match the layer
*name* anywhere in the path, since folder depth varies across apps). A
validation-library import inside those layers is a finding: it means data is
being re-validated after the boundary already guaranteed its shape, or the
boundary was drawn in the wrong place. This pass needs a real import search — the
cast equivalence does not surface it, because re-validating already-typed data
needs no cast.

### Seam ambiguity

If you cannot tell whether a crossing is a boundary (e.g. an adapter that both
receives external payloads and is called internally, or a module whose layer is
unclear), that ambiguity is itself a finding: name the **upstream architectural
cause** (the seam is mis-drawn, the layer is unlabelled, an adapter conflates
external and internal entry) rather than guessing present/absent.

## Letter-vs-intent

The lens's catch-rate lives where the type reads correct but the rule is
defeated: a handler that "has types" because every field was hand-asserted past
a missing schema; a domain module that ships its schema alongside its type so
the validation library has quietly leaked inward; an environment read tucked
into a module that is not the config factory. A finding here must explain *how
the code reads typed yet the boundary rule is defeated*, grounded in the specific
loaded rule — "name the boundary, write the schema, parse at the seam, map to
plain internal shape, propagate inward" is the remedy; "just type it" is the
smell. Vague phrasings ("validation looks weak", "should probably parse this")
are the lens's own failure mode.

## Output shape

Produce the counts the dispatching agent mandates. The boundary inventory walk
is mandatory and so are the counts it yields: crossings inspected / validated /
typeless; library returns inspected / validated / accepted-at-face-value;
internal validation-library imports; seam ambiguities. Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
the id its frontmatter declares. For any missing-schema finding whose observable
symptom is a cast, name the cast as the symptom and the missing schema as the
defect (the cast itself belongs to the type-soundness lens). For any seam
ambiguity, name the upstream architectural cause. State the code-discipline path
you resolved and which rule ids you loaded under this lens.
