# Internal onboarding ownership contracts

This private Phase 1 implementation records two internal contracts. They do not
add a runtime approval step. Public release, landing and whole-release proof are
separate operations; this record does not claim them complete.

## Channel and permission prose

The CLI already reads each host's distribution and holds the bound native
command routes. After a successful distribution read, it constructs one
`OnboardingContext` from that channel, the distribution's `permissionsLine` and
the existing `NativeCommandRoutes.prefix`. It does not read the distribution
again or construct another command authority.

Copy context contains only `channel: copy`. Native context contains the existing
prefix-only or exact-reads meaning and the route prefix in an immutable,
validated `OnboardingPermissions` value. This value describes the distribution's
permission prose. It is not a permission grant or evidence of installed rules.
Unknown policies and missing/non-string prefixes are data refusals. The prefix
is otherwise preserved verbatim, including empty strings: this boundary does
not introduce command parsing, trimming or a new route grammar. Copy does not
require unused native facts.

The captured-host port consumes this one context. Its compile, capture and
assembly order is unchanged; the host's fills capability is still called once
after full capture succeeds. The same context selects common Hook/Tools/CWD
channel behavior and host fills, avoiding independent channel selectors.

Each host owns where its permission prose appears. Codex uses its prerequisite
tail; Cursor, Kiro CLI, Kiro IDE and opencode use their own prerequisite field.
They retain their complete authored copy wording. For native they use the
modeled policy sentence with the bound route prefix before document rendering.
Claude and Copilot retain their existing authoring and only receive the coherent
input. Custom fills may ignore it and retain their exact authored value.

The shared sentence is rendered from existing policy/route facts in Projection's
domain. Packaging's legacy compatibility reader reuses that meaning; it still
recognizes unadmitted/custom prose as before. Its global fallback is retained
while the remaining invocation/custom responsibilities are transferred. This
contract does not claim that all native final-text rewriting has been retired.

## Declared authored-file placement callback

`AuthoredPlacement.prompt` is an optional, explicitly declared synchronous owner
at an authored placement. Its inputs are the successful prepared content and
selected distribution channel. It runs after destination validation and source
preparation; it does not receive a second source-reading capability. Preparation
refusals pass through before it runs.

A null result declines ownership and preserves the prepared content and original
harness-authored origin. Ordinary prompt lines serialize without policy
authority. A native-policy prompt is an assertion by the trusted semantic owner
that its lines express the named existing obligation. The actual placement
serializer consumes those lines and records its completed path, mode and decoded
text. The receipt proves snapshot continuity, not independent semantic parsing,
author authentication or installed permission enforcement.

Cursor declares the doctor slot at its one real rule placement. Exactly one
whole-line slot receives copy/native meaning; absent, duplicate, malformed,
quoted or stale declarations earn no receipt. Opaque invalid UTF-8 is declined.
The byte-backed representation is preserved when valid authored bytes are
reserialized. Packaging still owns eligibility, ordered mandatory-presence
refusal and masking. Its legacy replacement also continues for separate matching
custom text, even when another file already carries an admitted obligation.

These contracts are implemented as internal capability boundaries, not a global
transformation registry. They require neither a host finalizer nor host syntax
inside Packaging. The previously reviewed doctor behavior is preserved.
