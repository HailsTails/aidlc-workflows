# Rin fork differences from upstream

## Repository automation

The fork removes upstream's `.github/workflows/ai-pr-review.yml` by operator
choice. CI does not launch review agents, assume a Bedrock review role, or publish
agent-generated reviews. Deterministic build, test and security checks remain.
This is a local repository policy, not an upstream bug fix or upstream candidate.
Reconsider only if the fork's maintainers explicitly choose agentic CI.

Comparison baseline: upstream AIDLC **2.9.0**, commit
`22f5d1b15a064c9ae80046e5b1761d5877e2f69f`. This extraction ports the
already maintained 2.9.0 differences. It does not replay the upgrade from an
older release. The registry identifiers below identify capabilities, not a
second file ownership database.

## Philosophy and ownership

Most retained changes repair execution or make existing plugin contracts work
across harnesses. Three differences affect workflow philosophy: optional
per-stage autonomous approval, collaborators doing bounded work, and avoiding
repeated delivery of ambient rules. They must be evaluated independently at an
upstream update; equivalent code structure alone does not establish equivalent
behavior.

Human approval remains the default when a stage omits `approval_mode`. A stage
can explicitly select autonomous approval. This removes the human checkpoint
for that stage; it does not remove review, freshness checks or the audit trail.
Consumers own which stages make that choice.

Composition keeps upstream's **no-clobber default**. An explicit engine plugin
sync uses upstream's existing ownership hashes and transaction to replace
unchanged owned files and remove unchanged owned files absent from the next
projection. That is the intended Rin refresh choice, including renamed stages.
A modified owned file refuses the transaction; an unknown file remains. A
legacy installation without a hashed stage record cannot authorize deletion:
first perform a genuine baseline sync, then test the rename and next sync.
No ownership hashes are fabricated from names or presumed install history.

Public core owns general workflow and harness mechanics. The reusable Rin
plugin owns its stages, review protocols and configurable guard behavior.
The consumer owns its backlog service, identity, operational lanes, commands,
permissions and model budget. Installed output comes from maintained source;
generated `dist` trees are not another place to author policy.

## Verification snapshot

The current reusable plugin suite passes 111 files and 2,067 tests. Public type
checking and linting pass, and all seven harnesses build. Installed native hook
transactions pass 19 tests with 112 assertions, including refusal when an
owned native registration is edited or removed without changing the plugin
projection. Selected-plugin core refresh
passes nine independent tests with 63 assertions, including repeated updates,
owned rename, Codex trust and atomic refusal of modified settings. Sensitivity
checks demonstrate that removing ownership proof would overwrite user edits.
Two isolated consumer roots pass the five configuration concerns, including
actual installed workflow and identity tools, private lane installation, vault
guards and host MCP configuration preservation. Bundled tools run without a
consumer dependency installation. These results do not claim that a live model
session has invoked every guard. The broader deterministic suite completed
432 files with 10,646 reported assertions. Its only failing file was the two
new unchanged-projection ownership controls, run against output built before
the shortcut repair. The final regenerated-output delta check passes all 41
tests and 480 assertions across hook transactions, core refresh and owned
documentation parity. All seven final payloads also pass the existing
two-build determinism check, and final type checking passes. Source
transfer, committed consumer installation, update/rollback and publication
remain pending at this checkpoint.

In the table, **build** means covered by this build/type/lint snapshot; **plugin**
means the passing reusable plugin suite. A named regression is the behavior to
retest at each baseline change, even where a current focused result is pending.

## Retained capability groups

| Registry | Difference and reason | Surface / affected consumer | Regression and current evidence | Retirement condition |
| --- | --- | --- | --- | --- |
| 1 | Plugin selection honors parked workflows, matching the engine's advised remedy. | `core/tools/aidlc-utility.ts`; consumers disabling core/plugin scopes. | Park then select without stranding live work; build, focused selection rerun pending. | Upstream honors parked workflows or supplies an equivalent supported transition. |
| 2, 3, 3a | Implementation evidence recognizes earlier branch work, already merged stage/source co-touches, and the workspace method layer. | `aidlc-state.ts`, `aidlc-graph.ts`; stages requiring workspace work. | Reject documentation-only evidence and unrelated record sweeps; accept genuine implementation/method output. Build; consumer evidence regressions pending. | Retire each recognition independently when upstream supplies it with equivalent scope. |
| 4, U1 | Graph topology is authored and compilation works without a committed generated seed. | Core stage frontmatter, graph loader/compiler; clean installs on every harness. | Empty generated tree builds the intended graph. Deterministic build passed. | Upstream regenerates equivalent topology from maintained source. Reconcile authored numbers rather than delete necessary topology. |
| 5 | Optional per-stage `approval_mode` is carried through schema, graph, approve, reject and orchestrator checks; failed checks precede revision mutation. | Core workflow tools; every harness, stages explicitly opting in. | Autonomous stages need no fabricated human reply; default human stages still require one. Build; full approval-path regression rerun pending. | Upstream adopts equivalent per-stage semantics across every decision path. Check-before-mutate has an independent retirement condition. |
| 6, U6 | Plugin agent tiers, document transforms and substitution tokens are projected using the same maintained packager as core. Bootstrap hook collisions are refused. | `scripts/package.ts`, `aidlc-plugin-emit.ts`, plugin contributions; all plugin adopters. | Native model/effort and resolved document tokens; authored runtime tables stay unchanged; bootstrap remains intact. Tier and plugin build tests passed. | Upstream projects these contracts natively and preserves the bootstrap boundary. |
| U8, U9 | Codex plugin agent Markdown produces native TOML; first install copies and validates native agents before checking dispatched stages. | Packager, plugin emitter and compose; Codex plugin adopters. | Clean install retains stages with usable native agents; authored TOML collisions refuse. Codex packaging and compose tests passed. | Upstream owns equivalent native projection, collision protection and installation ordering. |
| N1, N2, N3, N4, N5, N6, U2, U4 | Plugin manifest rows register and dispatch copied hook bodies; document tokens have public defaults. Core-only packages contain no Rin registrations. Selected plugin composition owns bodies and native registrations together using the existing transaction and contribution record. | Contributions, packager, harness emitters/adapters and compose; current Rin declarations cover Claude, Codex, Copilot, Cursor and OpenCode. Kiro's two faces declare no Rin hooks. | Core-only checks and 19 installed transaction tests pass, including owned rename/disable, conflicts with unchanged projections and trust. Nine core-refresh tests preserve component ownership across repeated updates. A live model session invoking every guard is not claimed. | Upstream supplies equivalent selected-plugin registration, component ownership and dispatch. Merely copying hook bodies is insufficient. |
| N3b | Codex trust entries derive from the same combined wiring as hook registrations. | Codex emitter; plugins contributing Codex hooks. | Installed transaction and repeated-refresh tests verify the seed against actual final group positions. Consumer global Codex configuration remains unchanged. | Upstream uses one complete wiring source for both surfaces; independent of hook-seam retirement. |

## Packaging cost

The existing packager bundles runtime Zod, jsonc-parser and the TypeScript
compiler API. Six retained audit tools use that compiler API; executing their
TypeScript with Bun does not provide it. Consumers need no dependency install.
Compiler bundling accounts for most of the plugin payload, approximately 46 MiB
for the current Claude projection after minification. Relative imports preserve
their authored paths. This repairs distribution of existing tools; it introduces
no dependency ledger, shared loader or consumer setup. Dependency-free audit
implementations remain future investigation, not part of this migration.
| 7, U3 | Event hooks and supported harness adapters prefer the invoking checkout, retaining fallback when payload checkout information is absent. | Core hooks/lib and Codex, Cursor, Copilot, OpenCode adapters; worktree users. | Events affect the invocation's checkout, not an earlier session root; fallback still works. Build; complete adapter regression rerun pending. | Upstream resolves each affected event from its current checkout with equivalent fallback. |
| 8 | Task-driven workflow synchronization refuses proven backward/completed-stage transitions. | `aidlc-sync-workflow-state.ts`; task-using harnesses. | Task labels cannot resurrect completed stages; missing ordering evidence retains prior permissive behavior. Build; focused regression pending. | Upstream applies equivalent forward-only checks to this activation path. |
| 10, 11 | Reviewer refusals direct the stage's review process; the architecture reviewer names the inspected tree and can refuse unavailable evidence. | State error text, reviewer protocol/persona; review-using consumers. | Avoid hand-authored authority receipts; reject wrong-tree reviews. Plugin reviewer tests passed; core receipt regression pending. | Upstream supplies equivalent earned-receipt guidance and tree-binding contract. |
| 12 | Harness payloads build in staging and swap into place instead of exposing partial rebuilds. | `scripts/package.ts`; concurrent readers of generated output. | Failed rebuild leaves a usable prior payload; new payload is complete. Deterministic build passed; concurrent failure probe pending. | Upstream provides an equivalent staged publication lifecycle. |
| 13 | Recovered machine-backfilled rejection rows do not falsely advance the review-attempt floor. Production freshness still invalidates earlier pipeline receipts when a rejection is recovered; the migration repairs the accidental shared-filter coupling. | `aidlc-lib.ts`, `aidlc-log.ts`; recovered workflows. | Revision backstop 14 tests and review/pipeline floor 12 tests pass. Recovered review budgeting remains unchanged; old pipeline receipts become stale. | Upstream independently preserves recovered review budgeting and production rejection freshness. |
| Review recovery accounting | Artifact-staleness and source-staleness recovery spend independent bounded allowances. Modern receipts bind to the pending request; ambiguous legacy causes refuse. | `aidlc-log.ts` review-attempt summary and recovery derivation; `aidlc-lib.ts` fresh review receipts. | Preserve cause-specific budgets, modern request binding and legacy refusal. This ports existing Rin behavior rather than introducing unlimited retries. | Upstream supplies equivalent independent accounting, receipt binding and conservative legacy handling. |
| Source identity | Root `.gate-runs/**` telemetry is excluded consistently from source fingerprints; nested application directories remain included. | `aidlc-lib.ts` Git and filesystem source-identity paths. | Root telemetry cannot invalidate implementation evidence, while nested production edits still do. | Upstream excludes the actual root telemetry writer surface with equivalent scope; broad ignored-file exclusion alone does not establish that behavior. |
| 15 | Mob collaborators perform bounded acts and report what those acts showed; only the lead integrates produced artifacts. | Ensemble protocol and all harness skills; stages declaring mob collaboration. | Seats can produce probes/fixtures without racing produced artifacts. Build; behavioral collaboration quality is not established by packaging. | Upstream adopts both practical collaborator work and an act-based contribution contract. This is a deliberate method difference upstream may decline. |
| 16 | Stage steering avoids retransmitting ambient rules while retaining validation and the governing rule list; directives carry seat dispatch data and protocols must be reread. | Steering/directive/orchestrator tools and all harness skills; consumers with ambient rule delivery. | Ambient dedupe has an explicit opt-out; seats/paths are carried without losing governing rules. Build; hermetic directive regression pending. | Retire dedupe, dispatch and reread obligations separately when upstream supplies each equivalent or ambient delivery changes. |
| 17, 18, 19 | Abandoned unstamped locks are distinguishable from acquisitions; platform FFI loaders resolve lazily and stop retrying a known unavailable API. | `aidlc-lib.ts`, `aidlc-usage.ts`; Linux/macOS/Windows and Node test consumers. | Live token-bearing acquisition remains protected; imports load without eager Bun FFI; unavailable gates fail within their real lock budget. Build; platform probes pending. | Upstream repairs each independent locking/loading behavior; a single Windows fix does not retire the other platform paths. |
| 20, 21 | Sensor writer notices reach Claude; Codex patch notices combine into one bounded context envelope without hiding gate failures. | Sensor verdict/dispatcher/state/hooks and Codex adapter; writing agents. | An unwritable detail file does not lose a writer notice; gate-time missing evidence still refuses; multi-file patch summaries survive. Plugin suite/build; focused host notice probes pending. | Upstream delivers equivalent writer feedback and patch aggregation; detail-file/audit behavior may retire independently. |
| U5b, U7, N7, N8 | Shipped Claude/Codex settings and OpenCode tier rows avoid imposing a provider; onboarding does not require a particular provider. | Harness settings/onboarding, tier tables; all adopters selecting their own provider. | Existing consumer configuration remains authoritative; native model identifiers are valid for the selected host. Tier/packaging tests passed. | Upstream ships provider-neutral defaults. Concrete role model choices require the separate policy decision below. |

## Fork defaults and consumer permissions

These are deliberate policy choices, separate from correctness fixes. Existing
consumer model choices must remain honored by projection. Installation must
preserve the consumer's committed settings and permissions.

| Registry | Current policy | Why it needs a separate decision | Current evidence / retirement |
| --- | --- | --- | --- |
| U5a and additional permission delta | Public Claude settings retain narrow hook/tool/package command grants; the blanket plain `Bash` grant is excluded. | Narrow execution allowances and unrestricted shell permission have different effects. Broad permission belongs to the consumer's existing settings. | Source diff verified; rebuilt-output verification remains owed after this removal. Retire narrow grants when upstream supplies their equivalent, independently of provider neutrality. |
| 6b | Claude judgment pins `opus`; templated pins `sonnet` with medium effort, matching balanced. | These are fork model-budget choices. Provider neutrality and role model selection have separate ownership. | The complete maintained table is in [fork policy](../guide/rin-fork-policy.md), checked against shipped tiers. Reconsider each role default when the chosen budget changes. |
| U7 model choice | Codex balanced/templated rows name `gpt-5.6-terra`. | This is an intentional provider-neutral fork model default. Removing a provider prefix remains independent from choosing a concrete model generation. | Tier tests passed. Retained as a documented fork default; revisit when the fork's selected model policy changes. |
| OpenCode role policy | Templated roles retain medium variant, matching balanced, without a model or provider pin. | This is a fork effort default; retaining host model choice does not imply inheriting every host effort setting. | Owned fork policy and tier tests record the current projection. Reconsider independently from provider defaults. |

## Retired and consumer-only differences

| Registry / area | Disposition and reason |
| --- | --- |
| 9 | The old doctor hook-path regex workaround is behaviorally retired: upstream's command-only JSON walk excludes permission strings structurally. Historical comments do not represent a retained executable fix. |
| 14 | Unmarked output-directory reclaim is omitted. Directory-only contents do not prove packager ownership; upstream's valid-marker refusal remains. A generic retry convenience must not authorize deleting an unknown directory. |
| Private reservoir and operational lanes | Kept in the Rin consumer, including their service binding and operational knowledge. They are not public framework defaults. |
| Extra Rin Codex/OpenCode adapters | Kept in the consumer with its existing tests and live harness copies. They are separate from public generic harness adapters and are not emitted by the reusable public plugin contract. |
| Consumer installers | Existing consumer installation/refresh policy stays in Rin. Copied orphan installer helpers are excluded from the public plugin; this does not remove the active consumer installer. |
| Tests and fixtures | Maintained in public source where they exercise reusable behavior, excluded from shipped runtime payloads. Consumer installed-state assertions stay with their consumer. Source filtering is packaging ownership, not deletion of maintained tests. |

## Updating this account

At an upstream update, compare maintained `core`, `harness` and `scripts` with
the pinned pristine tree, then re-evaluate each capability's retirement
condition. Include new files and keep source tests in the comparison where they
establish a capability. Re-run the behavioral paths above; literal anchors and
green build output cannot detect every newly split upstream approval or dispatch
path. This account does not claim publication, consumer migration, or the full
upstream test suite is complete.
