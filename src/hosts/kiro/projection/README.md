# Kiro agent document preparation

The Kiro JSON agent renderer prepares each agent document through this adapter. It does not implement a complete Harness.

## Owned boundary

`decodeKiroAgentDocument` parses JSON once and runs one composed edge schema. It produces tagged document, resource, hook-collection, hook-group and hook-row states. Invalid hook shapes are represented rather than refused during decoding: an undefined suffix must still bypass them, and an earlier model failure must retain precedence.

Unknown properties and nested values are opaque retained fields, represented as ordered name/value entries. They are copied or encoded, never inspected by the preparation stages. This representation preserves an own `__proto__` field, which a Zod record/object round trip can discard. It also preserves non-finite numbers produced by valid JSON numeric overflow. The schema decodes only fields preparation actually observes; it is not a closed Kiro schema or a general JSON framework.

Model, resource and hook preparation consume tagged states without schema calls or narrowing unknown values. Model selection remains with the existing policy owner. A `preserve` decision supports conductor documents without applying persona policy.

Expected failures are named local refusal values. The public result uses the existing `host-source-unreadable` member of `ProjectionRefusal`, carrying the caller's host and source. Diagnostic wording names the preparation stage and deliberately does not copy JavaScript engine crash messages. The renderer preserves preparation refusals unchanged; its own missing-file and invalid-path refusals remain `render-failed`.

## Recorded legacy intermediate-serialization quirk

The packager at `caea995ae` serializes after model projection and after shared-glob expansion. JSON serialization turns numeric overflow such as `1e400` into `null`. A later preparation step can therefore refuse a value that it would otherwise accept.

The edge decoder names only the observable cases as `legacy-overflow`, `legacy-overflow-hooks` and `legacy-overflow-row`. For example:

- A conductor containing `1e400` with no formatting step retains its raw bytes. Model deletion formats it first, so shared-resource preparation then refuses the legacy null value.
- A hook row containing `1e400` is accepted without earlier formatting. Model projection or shared-glob expansion formats first, so hook preparation refuses that row as legacy null.
- Unknown nested overflow values need no traversal. Final JSON serialization already gives the same emitted null bytes.

These tags replace the previous generic recursive number-normalization pass. They are parity debt, not desired Kiro admission policy. Remove them only as a deliberate behavior change, with explicit before/after expectations and re-recorded goldens. The literal quirk tests and bounded pinned-function comparison are the evidence to update when that decision is made.

## Caller contract

Preparation runs once after token substitution, using the captured content and the existing host/source identity. Its Result is consumed directly; an expected refusal is never thrown to transport it through a catch. Policy-resolution order and the captured-persona/tier refusal handling are unchanged.

The runtime `writeKiroAgentSurface` export and its runtime callers stay. Preparation never runs again in a renderer on already prepared content. `bun scripts/parity/dist-goldens.ts --check` is the packaging proof.
