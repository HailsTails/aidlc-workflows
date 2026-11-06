# Rin refresh-policy source composition

## What this entry owns

`application/refresh-contract.ts` owns Rin's closed, reviewed before/after declarations. `application/refresh-notes.ts` owns the work those changes leave owed. The declarations retain the exact framing and seat/decision-record pairs; partial, reversed, other-plugin, and additional unproved changes remain outside them.

Core owns pure workflow-contract comparison, generic sensor rules and exact-field rewriting. Unknown stage fields and retained scope membership stay in the comparison. Core's adapter owns filesystem snapshots and the existing transaction callbacks. No plugin manifest, environment variable or dynamically discovered module can supply compatibility claims.

Ordinary `aidlc config` keeps upstream's existing open-workflow behavior. Rin declares `aidlc rin-config` through its existing plugin command contract. Its `tools/rin-config.ts` explicitly selects the Rin policy and supplies the `config` verb after the dispatcher removes `rin-config`. The repository packager closes this command's runtime dependencies while preserving its authored filename. This is not a new blanket gate in generic config and does not restore the predecessor's `--refresh-open-workflows` flag.

After installing and syncing Rin, use `aidlc rin-config --project-dir <project> --from <payload> --dry-run --json`. Review the plan and apply with the returned `--plan-token`, omitting `--dry-run`. This command supplies Rin policy to core configuration only.

## Refresh an installed plugin

After inspecting the emitted plugin source, run:

```
aidlc rin-plugin-refresh --project-dir <project> --plugin-root <emitted-plugin-root> --json
```

This is a direct sync, with no preview or plan-token approval protocol. It refuses `--dry-run` and `--plan-token` before project resolution or staging. Its JSON result records `refreshCompatibility` and owed-work notes; quiet text still prints substantive notes. Those observations are not a workflow approval.

Core captures installed metadata and workspace inputs before staging, retains the capture across retries and assesses the actual final plugin transaction under the shared config/state audit lock. Empty plans validate both existing and policy guards. Selected-policy failures never become a generic successful retry. Ordinary Core plugin sync remains unchanged. Rin's default adapter loads the literal, named policy-capable Core API; it cannot fall back to an older generic API.

The metadata policy does not establish that arbitrary changed plugin runtime code preserves behavior. Workspace-rule changes and other operations under `aidlc/` remain outside its preservation contract. A shipped plugin root with its native host manifest and bootstrap is required; an authored source folder is not an installed update artifact.

## Run from the producer checkout

The legacy source entry delegates to the same command composition and retains its existing `config` argument:

```
bun scripts/rin-config.ts config --project-dir <project> --from <payload> --dry-run --json
```

Review the plan, its notes and `refreshCompatibility` evidence. Apply through the same source entry, without `--dry-run` and with the returned `--plan-token`. The policy identity, installed and resulting metadata, workflow/rule input hashes and actual transaction operations participate in that token. A plan from the Rin entry is not interchangeable with one from ordinary config.

This is an existing-install refresh boundary. It does not promise that arbitrary metadata changes are compatible, and it is not proof that every changed runtime implementation preserves behavior. With no open workflow obligations, metadata changes do not acquire a compatibility gate merely because the policy was selected. Unreadable inputs and direct workflow/workspace mutations still cannot establish this entry's preservation contract.

## The actual resulting installation

The adapter derives candidate metadata from the transaction itself, not an unrelated prepared-source directory. Writes and copies supply their bytes; a tree replaces its subtree; a removal does not fall back to installed data; untouched metadata remains an input. Ambiguous paths, overlapping Windows case aliases, redirected/unreadable metadata and lossily decoded text cannot establish compatibility.

Workflow, authoritative composed-scope records under `aidlc/scopes`, and authored-rule inputs are captured before config prepares its payload, then checked again when planning and under the existing transaction lock. Sparse staged candidates are checked through the same resulting-view interpretation. Committed metadata is checked against the approved result. Existing hook checks and rollback remain active. Explicit empty plans validate freshness under config's audit lock instead of relying on a transaction callback that an empty transaction would skip.

## Records, provenance and owed work

The policy performs no workflow migration, advances no workflow, fabricates no receipt and does not rewrite earned approvals. Its transaction refuses operations in the workflow workspace. Compatibility effect names and human-facing notes do not enforce revalidation.

Config is not universally byte-read-only, including on dry-run or refusal. Its existing Claude provenance owner settles pending host turns before planning; that may record HOST_TURN evidence and withdraw derived reply material. After a successful refresh, the existing memory owner refreshes generated `aidlc/active-memory` and applicable Kiro steering. Those effects remain intact. Authoritative space memory and unrelated workflow records are preserved by this policy, rather than being confused with generated copies.

The framing note still says that nothing rechecks the outstanding questions. Seat/reviewer notes still name fresh review and named-seat work owed. Their display is not evidence that every downstream gate enforces those obligations. Real record migration or approval invalidation requires a separate reviewed design.

## Consumer boundary and validation

The repository packager emits both declared commands through the existing plugin command contract and closes their dependency graphs. Selected plugin composition owns the installed files and command records. Source-relative imports must not simply be copied into an install. The standalone shipped plugin builder remains a separate consumer without this repository runtime-preparation step. Packaging, copied-command behavior, update ownership and native host activation are separate qualification claims.

Interactive setup walks retain the selected policy through their child configuration calls. Substantive owed-work notes remain visible in quiet mode as warnings. An unchanged installed contract remains compatible; normal config can still write its baseline, so an unchanged refresh is not a promise of a zero-operation plan.

Current copied upgrades can hand configuration to a newer release's generic dispatcher. If an explicit policy would be lost at that handoff, config refuses and asks for that release's reviewed policy composition. It never silently falls back to generic config or disables ordinary newer-release routing.

Pure Bun cases live in `application/*.bun-test.ts`; the unit entry is `tests/unit/t-rin-refresh-policy.test.ts`. Real Rin config/transaction controls use `tests/integration/t-rin-refresh-policy.test.ts`. Generic snapshot/path, transaction and handoff controls are separate framework tests. They cover exact Rin changes and adjacent refusal, private-rule and state freshness, actual staged bytes, tree replacement/removal, rollback, empty plans, token separation, generic open-refresh behavior, host-turn settlement and generated-memory refresh. Synthetic records and host inputs establish bookkeeping behavior only, never a genuine human approval. The quiet control uses the exact reviewed Rin seat tuple with unrelated plugin sensors omitted from its synthetic core fixture; it is not a shipped plugin acceptance test. Windows directory-junction refusal is exercised locally, but the predecessor file-symlink control remains unverified because this Windows environment cannot create that link.

Preview-hook repair or enablement is outside this refresh-policy integration. Existing transaction hook ownership checks are a separate safety responsibility.
