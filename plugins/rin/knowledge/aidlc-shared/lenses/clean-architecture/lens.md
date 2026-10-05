---
lens: [clean-architecture]
fuelled-by: code-discipline rules tagged `lens: clean-architecture`
---

# Clean-architecture lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: clean-architecture`
from the codebase under review and treat their text as authoritative. This file
describes only *how* the lens reads code — the concept, the inspection procedure,
and the output shape. It names no specific rule numbers, file paths, type names,
or library names; those live in the loaded rules and differ per codebase.

## Concept

This lens defends **structural-semantic boundaries**: the directions data and
dependencies are allowed to flow, and the classification of the data that crosses
the outermost edge. It is one concept with four faces:

- **Dependency direction.** The import graph points inward. An inner layer
  (domain) depends on nothing; each outer layer may depend only on layers more
  inner than itself; the outermost layer (transports) is a leaf nothing imports.
  An import that points outward — a domain module reaching into a transport, an
  application orchestrator reaching into an adapter — is the violation, even when
  every symbol it touches is locally well-typed.
- **Storage behind a port.** Storage is a capability named by a repository port;
  the adapter behind the port composes the raw driver primitives. Inner code talks
  to the port and never knows whether the backing is a database, a filesystem, an
  in-memory map, or a remote service. Inner code importing a storage driver
  directly is the violation.
- **Data classification at the edge.** Data leaving the system into a log, a URL,
  or the repository carries a classification. The default for free-form strings
  is "sensitive/PII unless proven otherwise"; the opt-out to log-safe is explicit
  and auditable; secrets are pinned to the type system so the redaction layer can
  enforce them wherever they flow. An unannotated secret or PII string reaching an
  edge is the violation.
- **Minimal surface.** The system's externally-reachable surface — public network
  bindings, per-service resource budgets — has hard caps. Exceeding a cap is not a
  code smell to weigh; it is a violation that requires an explicit, tracked
  decision to override.

Across codebases the concept recurs under different names (hexagonal / ports-and-
adapters, onion layering, the dependency-inversion principle, data-classification
or taint rules, attack-surface budgets). The loaded rules tell you this codebase's
exact shape: the names of its rings, which driver primitives are forbidden inward,
the brand/annotation idiom for classifying data, and the specific surface caps.
Read them first; they override any default intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states the
   resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path** — an unloadable ruleset is never a codebase without discipline (ensure the pinned plugin installation and its `{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/` directory are present in the review worktree), and reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value is
   `clean-architecture`.
3. Read each kept rule in full, including its carve-outs / permitted-site sections.
   Those sections are the closed exception list — anything outside them is a
   finding. Where a rule names exact permitted sites (a single adapter file, a
   single redaction layer, a closed list of binding counts), those are the only
   permitted sites.
4. If zero rules carry this lens tag, report that the codebase declares no
   clean-architecture discipline and produce an empty finding set — do not invent
   rules.

## Inspection procedure

This lens reads one direction and one classification per artefact. For each
changed file, identify its layer (the rules name the rings and how a path or
package maps to one), then walk its imports and its edge-crossing call sites.

### The inward-arrow read (dependency direction + storage-behind-port)

For every import in a changed file, ask the single question the layering rules
encode: *does this import point inward toward the system's own abstractions, or
outward toward a raw library, a raw stdlib module, an ambient global, or a more
outer layer?*

- **Cross-layer outward import.** Map the importing file's layer and the imported
  module's layer. An import that points outward (inner depending on outer) is a
  finding against the layering rule. The permitted shapes are inner-on-inner,
  outer-on-inner, and a boundary file importing the raw outer-world library it
  exists to wrap — everything else is the forbidden outward arrow.
- **Inner code importing a storage/driver primitive.** Inner layers (domain,
  application) importing a database driver, a filesystem module, or any raw
  storage primitive is a finding against the repository-port rule: the inner code
  reached around the port. The correct shape is a port type declared with the
  domain, a default factory wired at boot, and an adapter file that composes the
  driver behind the port.
- **Type-only does not escape.** A type-only import still couples the consumer to
  the outer world's type shape; if the rules say type-only follows the same rule,
  read it the same way as a runtime import.
- **Re-exports and dynamic imports do not escape.** A re-export still imports the
  outer module to re-export it; a dynamic `import(...)` / `require(...)` is still
  an import. Read the import line, not the consumption pattern.
- **Borderline heuristic.** "Could this file be reasoned about without knowing
  which platform/library it runs on?" If yes, its import direction is likely
  correct; if no, find the port it should depend on and let the boundary file
  shoulder the platform-specificity. The whole point of the abstraction layer is
  that *most* files should pass this test and only a small contained set fail it.

### The classification read (PII / secrets / data at the edge)

For every call site that emits data into a log, a URL, a response body, or the
repository, ask what classification the emitted fields carry:

- **Unannotated PII in a log.** A logged field whose value is a free-form string
  sourced from user input, an external response, a parsed external message, or a
  stored row, and which lacks the explicit log-safe annotation the rules define,
  is a finding. The remediation is to confirm the field's classification and
  either annotate it (if genuinely safe) or remove it from the payload (if not) —
  never to rubber-stamp it safe to clear the check.
- **Unbranded secret.** A schema or type whose identifier or shape reads as a
  credential (token, secret, key, password, session key, bearer, authorization,
  refresh/access token, OAuth material) but which is held as a plain string
  without the sensitive brand the rules mandate is a finding: the value is
  indistinguishable from a normal string and can slip past the redaction layer.
  The remediation is to brand it at the declaration site and propagate the branded
  type to every consumer.
- **Secret at a forbidden surface.** A hard-coded credential literal in committed
  source, a secret placed in a URL query parameter, or a sensitive-branded value
  reaching a log without passing the redaction layer is a finding. (Operational
  backstops — secret-manager wiring, env discipline, deploy-side rotation,
  external scanners — are upstream of this lens; it flags only the source-level
  artefact that would arm them, and clearly-fake test fixtures on an audited
  allowlist are out of scope, deferring to test-discipline.)

### The minimal-surface read

For every change that adds or widens an externally-reachable surface — a new
public network binding, a service whose steady-state resource footprint may exceed
the per-service cap — check it against the rule's hard cap. Exceeding a cap is a
finding unless the change carries the explicit tracked decision the rule requires
to override. The cap is a number, not a judgement call; "it's only slightly over"
is not an exception.

For each candidate, decide finding vs non-finding strictly against the loaded
rules and their carve-outs — never against this file's prose or a remembered
version of some other codebase's rule.

## Letter-vs-intent

The lens's catch-rate lives where each symbol is locally fine yet a boundary is
defeated. An outward import compiles cleanly and every name it touches is valid —
the defect is the *direction*, not any one symbol. A logged field is a legal
string — the defect is its missing classification. A surface addition is valid
config — the defect is that it crosses a capped budget. A finding must explain
*how the local code reads correct yet the boundary rule is defeated*, grounded in
the specific loaded rule.

Two cross-lens notes worth holding while reading, expressed as method (never by
re-tagging the rule another lens owns):

- **Ambient globals and raw-library wrapping.** Some codebases enforce the same
  inward-arrow shape on raw third-party libraries and stdlib modules through a
  *separate* set of rules (often owned by a dependency-injection / wrapping-factory
  lens, sometimes keyed to capabilities that have a dedicated port). When you see
  inner code call an ambient global or import a raw library outside its wrapping
  site, the *layering* defect is yours to name, but the rule citation may belong to
  that sibling lens — cite the rule the loaded ruleset actually declares, and flag
  the boundary observation rather than inventing a layering rule that doesn't carry
  this lens tag. The wrapping-factory file *is* the permitted seam; the boundary
  violation is only the import that skips it.
- **Default-factory siblings.** A permitted wrapping/adapter site should also ship
  the default factory its DI rules require; the *internal shape* of the port
  (capability naming, factory presence, generic binding) is the DI lens's lane.
  Note a missing default-factory export as a sibling observation, not as a
  clean-architecture finding of its own.

Vague phrasings ("this coupling feels wrong", "might leak data") are the lens's own
failure mode — every finding names the specific boundary and the rule that draws it.

## Output shape

Produce the counts the dispatching agent mandates (e.g. imports inspected,
outward-arrow / cross-layer violations, inner-code-importing-driver violations,
ambient-global call sites, unannotated-PII log emissions, unbranded-secret
declarations, secret-at-forbidden-surface hits, minimal-surface cap breaches).
Every finding is `file:line | quoted code | <rule-id> | defect-named`, citing the
loaded rule by the id its frontmatter declares. State the code-discipline path you
resolved and which rule ids you loaded under this lens.
