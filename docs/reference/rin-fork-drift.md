# Rin fork differences from upstream

## Repository automation

The fork removes upstream's `.github/workflows/ai-pr-review.yml` by operator choice. CI does not launch review agents, assume a Bedrock review role, or publish agent-generated reviews.

The fork also removes upstream's other workflow files and owns its small `.github/workflows/rin-ci.yml` separately. Pull requests run one source-check job: frozen dependency installation, one package build to materialize the generated modules imported by source/test checks, type checking, lint and the Rin constitution audit. Its limit is ten minutes; a new push cancels the older run. There are no scheduled previews, push-triggered jobs, release pipelines, documentation deployments, security-scanner jobs or test matrices. Generated-adapter checks, determinism checks, tests and security scans remain local verification responsibilities. A green CI result covers packaging and source checks only. This budget choice is intended for the current two-maintainer fork. This is a local repository policy, not an upstream bug fix or upstream candidate. Reconsider only if the fork's maintainers explicitly choose agentic CI.

Tests that asserted the removed upstream workflow YAML are retired with those workflows. Tests of the retained installer, release planner/publisher, version grammar, review tools and prompts remain. The source-check job does not execute those retained release or review tools.

Comparison baseline: upstream AIDLC **2.10.0**, commit
`7a61fa7b2bca5bc701ab0a7e6ca3608df8f4694f`. The separate upstream-sync
branch merges that immutable pin into fork main `7f7118df5b02c4703e2182e6ce36520cfca5d587`,
preserving both parents. The previous extraction baseline was 2.9.0 at
`22f5d1b15a064c9ae80046e5b1761d5877e2f69f`. The registry identifiers below
identify capabilities, not a second file ownership database. Verification
snapshots below retain their original dates and scope; they are not results
for this new baseline.

## Philosophy and ownership

Most retained changes repair execution or make existing plugin contracts work
across harnesses. Four differences affect workflow philosophy: optional
per-stage autonomous approval, collaborators doing bounded work, avoiding repeated delivery of ambient rules, and explicit compatible refresh while independent workflows remain open. They must be evaluated independently at an
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

The 2026-10-01 assessment builds all seven harnesses with byte-identical results across two independent builds. Public type checking and linting pass, as do the reusable plugin suite (111 files, 2,067 tests), constitution audit (zero violations across 229 files), derivation self-test (94/94) and colocated autonomy/hook-registration tests (22 tests, 46 assertions). The clean source-only CI sequence was exercised locally from a tree initially without generated distributions; no new remote CI result is claimed.

The full default deterministic run finished with exit 2: 432 files, two failed files, 10,636 reported assertions and four failed assertions. Two release-fixture tests exceeded Bun's default five-second limit; both pass with the 30-second budget already used by neighboring fixture tests, now assigned to those two tests without changing assertions or transport timeouts. The remaining proxy assertion passes unchanged in a child process without inherited proxy variables; an independent loopback probe confirms Bun 1.3.14 retains startup `NO_PROXY` behavior despite later environment deletion. A Cursor home-alias test fails because this environment's actual home is read-only. These diagnostic results do not make the default suite green. Live Claude-dependent cases were skipped by the runner. The full run preceded the final portable-consumption fixes; the plugin and build checks cover those final changes.

Four test files retaining assertions against deliberately removed workflow YAML are repaired: the focused run passes 68 tests with 15 platform skips and 754 assertions. Runtime installer, planner/publisher, review-tool and grammar coverage remains. Reviewer and lens authority paths now name the projected installed rule corpus, keeping the existing CANNOT-REVIEW boundary if that corpus is missing. The debt-inventory tool resolves its rule corpus beside its module, so a consumer need not contain the authored plugin tree; its 22 unit tests pass and source execution preserves the previous inventory output.

The compatible-refresh addition passes the prescribed build, two-build determinism, three TypeScript checks and lint. Its eight focused cases cover open/parked state preservation, absent workspace seeds, update/restore, ownership refusal, schema/contract refusal and rollback through the existing transaction. Together with dispatcher and configuration regressions, the focused run passes 150 tests; ten existing refresh/adoption tests also pass. Pre-manifest adoption now recognizes exact source bytes before generated tables change them, while refusing edited files. These results do not replace the recorded full-suite limitations.

An archive-based update/restore rehearsal exposed an existing core ownership error: copying an unknown consumer file into the staged graph projection accidentally claimed it in the next core manifest, allowing the following refresh to delete it. The fix retains consumer overlays without claiming ownership and refuses regeneration that would modify them. The regression now checks the unknown file after both update and restore and checks that the manifest never claims it. That suite and all nine selected-plugin core-refresh cases pass together (17 tests, 103 assertions). A broader installer run passed 93 of 95 cases: the known proxy assertion and another release-fixture five-second budget failed. That fixture now uses the existing 30-second fixture budget and passes without a CLI timeout override. The default full-suite result remains a failure as recorded above.

After the ownership repair, the prescribed build/determinism/type/lint command passes again. The combined refresh, plugin-refresh, dispatcher and configuration regression run passes 159 tests with 1,886 assertions; eleven existing refresh/adoption/fixture cases pass with 92 assertions. These are the final source checks for that repair.

A fresh project consumer was rehearsed using the existing copy archive and Bun, including native hook composition, ownership recording and explicit plugin selection. Installed tools load without a consumer dependency installation. Full native host inventory is a separate installation route. The installation guide records the exercised command order and runtime-root binding. Actual consumer cutover, update/rollback acceptance and publication remain pending; these source checks do not establish a live model session or a completed consumer migration.

In the table, **build** means covered by this build/type/lint snapshot; **plugin** means the passing reusable plugin suite. A named regression is the behavior to retest at each baseline change, even where a current focused result is pending.

### Pinned 2.10.0 sync validation, 2026-10-08

The sync uses upstream 7a61fa7b2bca5bc701ab0a7e6ca3608df8f4694f and fork parent 7f7118df5b02c4703e2182e6ce36520cfca5d587. All seven host packages build and are byte-identical across two independent builds. Source/test/adapter type checks and lint pass; the reusable Rin suite passes 2,404 tests in 118 files, and the Rin constitution audit reports zero violations across 242 plugin files.

The initial 53-file affected source/unit/integration run recorded 45 failing assertions in 12 files. Passing evidence was retained; conflicting contracts were repaired and checked in 326 selected cases across 13 files, with additional current-case checks after fixture naming and callback repairs. Those selected checks pass. Earlier failed runs remain in recovery evidence. This is scoped source verification, not the full upstream suite, live model execution, consumer migration, or native gate acceptance. The thirteen closed migration fixes and four approved bounded deferrals remain unchanged.

## Migration compatibility findings

The [2026-10-07 Codex compatibility account](rin-codex-compatibility.md)
extends this register with the migration's measured native behavior,
source-derived limits and unresolved repairs. It distinguishes upstream AIDLC
candidates, upstream Codex issues/compatibility constraints, Rin personal
requirements or drift, local setup defects and withdrawn assumptions, with
owners and removal conditions. No upstream acceptance is claimed.

The public producer at `50cda419` has the reviewed native hook-name,
marketplace, trust-identity and runtime-companion repairs. **V2 rule delivery
remains broken** because its opaque message is still rewritten; the name fix
and green source CI do not establish native delivery. A bounded V1 diagnostic
proved complete rule transport and real named-role handback, but its scribe
correctly refused a review verdict. All eight allocated investigation
invocations are consumed; call nine is unallocated. A later substantive READY
was genuinely captured with a matching engine receipt, but its mandatory
knowledge-read order and model-visible completeness failed verification.
Neither result earns a gate.

DD7/Five Whys and explicit open-workflow refresh remain Rin policy choices.
The reusable refresh comparison permits only coherent advisory write-sensor
registration changes while retaining gate/blocking sensors and all other
compiled completion contracts. The stronger universal pre-model admission
guarantee was introduced by the investigation and is withdrawn; canonical
delegated-rule and native-evidence requirements remain unchanged.

## Retained capability groups

| Registry | Difference and reason | Surface / affected consumer | Regression and current evidence | Retirement condition |
| --- | --- | --- | --- | --- |
| Consumer overlays | A core refresh may compile consumer-owned files into its staged graph without acquiring or deleting those files. Pre-manifest adoption recognizes exact original source bytes before regeneration. | `aidlc-init.ts`; consumers carrying local stages, tools or other overlay files. | Unknown tool survives update and restore and never enters the core manifest; edited pre-manifest source remains a conflict. | Upstream preserves these source/ownership boundaries across repeated refreshes. |
| 22 | Explicit `config --refresh-open-workflows` permits compatible payload refresh without closing a concurrent pipeline. The fork still refuses an ordinary refresh while workflows are open. Upstream now allows ordinary open-workflow refresh, which does not establish equivalent compatibility and rollback checks. | `aidlc-init.ts`, `aidlc-refresh-rules.ts`, `aidlc-refresh-compatibility.ts`; existing project installations. | Same state schema; every existing compiled stage/scope completion contract retained (coherent advisory write-sensor registrations may change); workspace data read-only; ownership conflicts retained. Candidate graphs and runners use exact retained default-space rule bytes; read-only refresh preserves missing inputs, while ordinary refresh retains normal seeding. Rule file membership and raw-byte hashes are captured before compilation, bound into plan approval, and rechecked before planning and under the existing transaction lock alongside compatibility metadata. Independent Claude/Codex rule-chain, runner, update/restore and stale-token regressions pass; focused input edit/add/remove, locked refusal, missing/seed and link-boundary cases pass. Existing schema/contract refusal and interrupted-transaction rollback coverage remains. | Upstream supplies equivalent safe refresh for independent workflows. This is intentional workflow-policy divergence, not a blanket force bypass or state-migration engine. |
| 1 | Plugin selection honors parked workflows, matching the engine's advised remedy. | `core/tools/aidlc-utility.ts`; consumers disabling core/plugin scopes. | Park then select without stranding live work; build, focused selection rerun pending. | Upstream honors parked workflows or supplies an equivalent supported transition. |
| 2, 3, 3a | Implementation evidence recognizes earlier branch work, already merged stage/source co-touches, and the workspace method layer. | `aidlc-state.ts`, `aidlc-graph.ts`; stages requiring workspace work. | Reject documentation-only evidence and unrelated record sweeps; accept genuine implementation/method output. Build; consumer evidence regressions pending. | Retire each recognition independently when upstream supplies it with equivalent scope. |
| 4, U1 | Graph topology is authored and compilation works without a committed generated seed. | Core stage frontmatter, graph loader/compiler; clean installs on every harness. | Empty generated tree builds the intended graph. Deterministic build passed. | Upstream regenerates equivalent topology from maintained source. Reconcile authored numbers rather than delete necessary topology. |
| 5 | Optional per-stage `approval_mode` is carried through schema, graph, approve, reject and orchestrator checks; failed checks precede revision mutation. | Core workflow tools; every harness, stages explicitly opting in. | Autonomous stages need no fabricated human reply; default human stages still require one. Build; full approval-path regression rerun pending. | Upstream adopts equivalent per-stage semantics across every decision path. Check-before-mutate has an independent retirement condition. |
| 6, U6 | Plugin agent tiers, document transforms and substitution tokens are projected using the same maintained packager as core. Bootstrap hook collisions are refused. | `scripts/package.ts`, `aidlc-plugin-emit.ts`, plugin contributions; all plugin adopters. | Native model/effort and resolved document tokens; authored runtime tables stay unchanged; bootstrap remains intact. Tier and plugin build tests passed. | Upstream projects these contracts natively and preserves the bootstrap boundary. |
| U8, U9 | Codex plugin agent Markdown produces native TOML; first install copies and validates native agents before checking dispatched stages. | Packager, plugin emitter and compose; Codex plugin adopters. | Clean install retains stages with usable native agents; authored TOML collisions refuse. Codex packaging and compose tests passed. | Upstream owns equivalent native projection, collision protection and installation ordering. |
| Codex plugin runner skill root | Ordinary plugin composition resolves Codex runners under `.agents/skills`, where Codex discovers them. This correction remains a fork difference at pinned upstream `7a61fa7b`; its ordinary compose template still uses `.codex/skills`. | `scripts/plugin-hooks-template/compose.ts`; Codex plugin adopters. | The retained `t318-plugin-compose-source-only` Codex case covers the fork correction, not pristine-upstream equivalence. The separate pruning path already uses the native root upstream. | Evaluate later upstream fix `fdcdd894` (#2241) at an adopted fork pin; validate ordinary composition, generated explicit-only guards and consumer installation separately. Native agent projection, component ownership and selected hook registration have independent retirement conditions. |
| N1, N2, N3, N4, N5, N6, U2, U4 | Plugin manifest rows register and dispatch copied hook bodies; document tokens have public defaults. Core-only packages contain no Rin registrations. Selected plugin composition owns bodies and native registrations together using the existing transaction and contribution record. | Contributions, packager, harness emitters/adapters and compose; current Rin declarations cover Claude, Codex, Copilot, Cursor and OpenCode. Kiro's two faces declare no Rin hooks. | Core-only checks and 19 installed transaction tests pass, including owned rename/disable, conflicts with unchanged projections and trust. Nine core-refresh tests preserve component ownership across repeated updates. A live model session invoking every guard is not claimed. | Upstream supplies equivalent selected-plugin registration, component ownership and dispatch. Merely copying hook bodies is insufficient. |
| N3b | Codex trust entries derive from the same combined wiring as hook registrations; upstream now owns the canonical timeout/matcher-aware hash. | Codex emitter; plugins contributing Codex hooks. | Installed transaction and repeated-refresh tests verify the seed against actual final group positions. Consumer global Codex configuration remains unchanged. | Upstream uses one complete wiring source for both surfaces; independent of hook-seam retirement. |
| 7, U3 | Event hooks and supported harness adapters prefer the invoking checkout, retaining fallback when payload checkout information is absent. | Core hooks/lib and Codex, Cursor, Copilot, OpenCode adapters; worktree users. | Events affect the invocation's checkout, not an earlier session root; fallback still works. Build; complete adapter regression rerun pending. | Upstream resolves each affected event from its current checkout with equivalent fallback. |
| 8 | Task-driven workflow synchronization refuses proven backward/completed-stage transitions. | `aidlc-sync-workflow-state.ts`; task-using harnesses. | Task labels cannot resurrect completed stages; missing ordering evidence retains prior permissive behavior. Build; focused regression pending. | Upstream applies equivalent forward-only checks to this activation path. |
| 10, 11 | Reviewer refusals direct the stage's review process; the architecture reviewer names the inspected tree and can refuse unavailable evidence. | State error text, reviewer protocol/persona; review-using consumers. | Avoid hand-authored authority receipts; reject wrong-tree reviews. Plugin reviewer tests passed; core receipt regression pending. | Upstream supplies equivalent earned-receipt guidance and tree-binding contract. |
| 12 | Harness payloads build in staging and swap into place instead of exposing partial rebuilds. | `scripts/package.ts`; concurrent readers of generated output. | Failed rebuild leaves a usable prior payload; new payload is complete. Deterministic build passed; concurrent failure probe pending. | Upstream provides an equivalent staged publication lifecycle. |
| 13 | Recovered machine-backfilled rejection rows do not falsely advance the review-attempt floor. Production freshness still invalidates earlier pipeline receipts when a rejection is recovered; the migration repairs the accidental shared-filter coupling. | `aidlc-lib.ts`, `aidlc-log.ts`; recovered workflows. | Revision backstop 14 tests and review/pipeline floor 12 tests pass. Recovered review budgeting remains unchanged; old pipeline receipts become stale. | Upstream independently preserves recovered review budgeting and production rejection freshness. |
| Review recovery accounting | Artifact-staleness and source-staleness recovery spend independent bounded allowances. Modern receipts bind to the pending request; ambiguous legacy causes refuse. | `aidlc-lib.ts` shared review-attempt accounting, recovery derivation and fresh review receipts; `aidlc-log.ts` request admission. | Preserve cause-specific budgets, modern request binding and legacy refusal. This ports existing Rin behavior rather than introducing unlimited retries. | Upstream supplies equivalent independent accounting, receipt binding and conservative legacy handling. |
| Source identity | Root `.gate-runs/**` telemetry is excluded consistently from source fingerprints; nested application directories remain included. | `aidlc-lib.ts` Git and filesystem source-identity paths. | Root telemetry cannot invalidate implementation evidence, while nested production edits still do. | Upstream excludes the actual root telemetry writer surface with equivalent scope; broad ignored-file exclusion alone does not establish that behavior. |
| 15 | Mob collaborators perform bounded acts and report what those acts showed; only the lead integrates produced artifacts. | Ensemble protocol and all harness skills; stages declaring mob collaboration. | Seats can produce probes/fixtures without racing produced artifacts. Build; behavioral collaboration quality is not established by packaging. | Upstream adopts both practical collaborator work and an act-based contribution contract. This is a deliberate method difference upstream may decline. |
| 16 | Stage steering avoids retransmitting ambient rules while retaining validation and the governing rule list; directives carry seat dispatch data and protocols must be reread. | Steering/directive/orchestrator tools and all harness skills; consumers with ambient rule delivery. | Ambient dedupe has an explicit opt-out; seats/paths are carried without losing governing rules. Build; hermetic directive regression pending. | Retire dedupe, dispatch and reread obligations separately when upstream supplies each equivalent or ambient delivery changes. |
| 17, 18, 19 | Abandoned unstamped locks are distinguishable from acquisitions; platform FFI loaders resolve lazily and stop retrying a known unavailable API. | `aidlc-lib.ts`, `aidlc-usage.ts`; Linux/macOS/Windows and Node test consumers. | Live token-bearing acquisition remains protected; imports load without eager Bun FFI; unavailable gates fail within their real lock budget. Build; platform probes pending. | Upstream repairs each independent locking/loading behavior; a single Windows fix does not retire the other platform paths. |
| 20, 21 | Sensor writer notices reach Claude; Codex patch notices combine into one bounded context envelope without hiding gate failures. | Sensor verdict/dispatcher/state/hooks and Codex adapter; writing agents. | An unwritable detail file does not lose a writer notice; gate-time missing evidence still refuses; multi-file patch summaries survive. Plugin suite/build; focused host notice probes pending. | Upstream delivers equivalent writer feedback and patch aggregation; detail-file/audit behavior may retire independently. |

## Packaging cost

The existing packager bundles runtime Zod, jsonc-parser and the TypeScript compiler API. Six retained audit tools use that compiler API; executing their TypeScript with Bun does not provide it. Consumers need no dependency install. Compiler bundling accounts for most of the plugin payload, approximately 46 MiB for the current Claude projection after minification. Relative imports preserve their authored paths. This repairs distribution of existing tools; it introduces no dependency ledger, shared loader or consumer setup. Dependency-free audit implementations remain future investigation, not part of this migration.

## Fork defaults and consumer permissions

These are deliberate policy choices, separate from correctness fixes. Existing
consumer model choices must remain honored by projection. Installation must
preserve the consumer's committed settings and permissions.

| Registry | Current policy | Why it needs a separate decision | Current evidence / retirement |
| --- | --- | --- | --- |
| U5a and additional permission delta | Public Claude settings retain narrow hook/tool/package command grants; the blanket plain `Bash` grant is excluded. | Narrow execution allowances and unrestricted shell permission have different effects. Broad permission belongs to the consumer's existing settings. | Rebuilt settings checks pass, including absence of broad Bash permission. Retire narrow grants when upstream supplies their equivalent, independently of provider neutrality. |
| 6b | Claude judgment pins `opus`; templated pins `sonnet` with medium effort, matching balanced. | These are fork model-budget choices. Provider neutrality and role model selection have separate ownership. | The complete maintained table is in [fork policy](../guide/rin-fork-policy.md), checked against shipped tiers. Reconsider each role default when the chosen budget changes. |
| U7 model choice | Codex balanced/templated rows name `gpt-5.6-terra`. | This is an intentional provider-neutral fork model default. Removing a provider prefix remains independent from choosing a concrete model generation. | Tier tests passed. Retained as a documented fork default; revisit when the fork's selected model policy changes. |
| OpenCode role policy | Templated roles retain medium variant, matching balanced, without a model or provider pin. | This is a fork effort default; retaining host model choice does not imply inheriting every host effort setting. | Owned fork policy and tier tests record the current projection. Reconsider independently from provider defaults. |

## Retired and consumer-only differences

| Registry / area | Disposition and reason |
| --- | --- |
| U5b, U7 provider neutrality, N7, N8 | The duplicate provider-neutral implementation difference is retired at upstream 7a61fa7. Upstream Claude/Codex defaults inherit the host provider, and OpenCode onboarding no longer requires a provider selection. Packaging, tier and source-only composition checks cover the adopted surfaces. Concrete role model/effort choices and Codex high session reasoning remain separate retained fork policy. |
| 9 | The old doctor hook-path regex workaround is behaviorally retired: upstream's command-only JSON walk excludes permission strings structurally. Historical comments do not represent a retained executable fix. |
| 14 | Unmarked output-directory reclaim is omitted. Directory-only contents do not prove packager ownership; upstream's valid-marker refusal remains. A generic retry convenience must not authorize deleting an unknown directory. |
| Private reservoir and operational lanes | Kept in the Rin consumer, including their service binding and operational knowledge. They are not public framework defaults. |
| Extra Rin Codex/OpenCode adapters | Kept in the consumer with its existing tests and live harness copies. They are separate from public generic harness adapters and are not emitted by the reusable public plugin contract. |
| Consumer installers | Existing consumer installation/refresh policy stays in Rin. Copied orphan installer helpers are excluded from the public plugin; this does not remove the active consumer installer. |
| Tests and fixtures | Maintained in public source where they exercise reusable behavior, excluded from shipped runtime payloads. Consumer installed-state assertions stay with their consumer. Source filtering is packaging ownership, not deletion of maintained tests. |

## Updating this account

Begin each upstream drift review with every retained capability's intended
outcome, invariant and reason for differing from upstream. Record the exact
upstream, fork and consumer pins being compared. Map each outcome to its actual
enforcement owners across engine and tool APIs, configuration resolution and
defaults, migrations and provisioning, harness adapters, and live agent-facing
instructions. Include the generated and installed surfaces those owners produce.

Compare those owners with the pinned pristine upstream tree, including
non-conflicting changes, new files and newly available native features. Trace
every applicable entry point and decision path; a clean merge, matching symbol
or unchanged instruction does not establish preserved behavior. Check whether
new code controls or changed defaults make an existing prose workaround
ineffective, unnecessary or contradictory, and whether configuration precedence
or upgrade behavior changes what an existing consumer actually runs.

For each outcome, distinguish upstream availability, fork inclusion and
consumer activation. Identify required configuration, installation, migration
and adoption steps, preserving the consumer's chosen policy and owned settings.
Retire drift only when the upstream implementation satisfies its original
reason across the affected paths. Separate independent obligations within a
capability so one equivalent mechanism does not erase another retained need.

Bind each retained, retired, regressed or unverified disposition to source
evidence and suitable behavior and configuration tests. Exercise positive and
refusal paths, defaults and overrides, and relevant upgrade or recovery paths
where those establish the invariant. Reuse passing evidence only for unchanged
owners and inputs; record its exact scope and pin, along with unresolved gaps.
Literal anchors, packaging checks and green CI are supporting evidence, not
proof of every behavior or native host enforcement.

Reconcile findings with the consuming project's active intents, bugs and
acceptance requirements. Close an item only when its complete acceptance scope
is satisfied at the adopted consumer pin; an upstream fix or prepared fork
change alone is a closure candidate. Distinguish historical records from live
guidance, and identify stale instructions in authored sources and their derived
outputs. Update this account with the resulting reason-based dispositions and
adoption conditions; publication, consumer migration, the full upstream test
suite and native workflow acceptance remain separately evidenced.

## Rin scope policy and ceremony controls

Rin scopes explicitly declare native `guard_policy: strict` to preserve the
chosen policy for new intents. Upstream known scopes without that declaration
default new intents to off; existing intents with no state policy field still
resolve strict. Scope defaults do not rewrite existing state or bypass explicit
user authorization and strict memory locks. This is workflow policy, separate
from host security and trust settings.

Stage autonomy and ceremony controls must be traced separately. Ceremony
controls existed by September commit `1b0645858`; autonomous stage approval
does not set those switches. An enabled switch alone does not prove a pause:
Rin stages omit summary checkpoints, and learning questions require human
gates. This change does not alter those ceremonies.

## Codex plugin runner location

At pinned upstream `7a61fa7b2bca5bc701ab0a7e6ca3608df8f4694f`,
ordinary composition in `scripts/plugin-hooks-template/compose.ts` still
looks under `.codex/skills`. A complete Codex installation discovers skills
under `.agents/skills`, so that lookup records an advisory and skips plugin
runner regeneration. PR #3 at `7b260d8c` retains the fork's native-root
correction; its `t318-plugin-compose-source-only` Codex regression exercises
the fork behavior. Upstream's separate `aidlc-plugin.ts` pruning path already
resolves `.agents/skills`, which does not establish ordinary compose behavior.

Later upstream commit
[`fdcdd894a1faecb458ae1b4d63c5b20ab3deef98`](https://github.com/awslabs/aidlc-workflows/commit/fdcdd894a1faecb458ae1b4d63c5b20ab3deef98)
(#2241) corrects the ordinary compose root and adds generated Codex runners'
`agents/openai.yaml` explicit-only guard. That commit is beyond this comparison
pin. It is a candidate for a future adoption review, not evidence that the
current fork or consumer has adopted it. Runner location, explicit-only
invocation, native agent projection, component ownership and selected hook
registration require separate acceptance evidence.

## Promotion rebuild adapter compatibility

The Rin promotion wrapper delegates to upstream V2 `engine hook rebuild-stage-graph` with `tool_input.source: ide-audit-sync`, the existing upstream audit-tail contract. This corrects the extraction's `audit-sync` spelling, which silently skipped rebuilds. Retire this wrapper when upstream recognizes the consumer promotion command directly; no new rebuild engine or approval policy is introduced.

Package-importing core tools use the same repository runtime/declaration companion emitter as plugins. Copy and native projections retain the authored import path and own their generated runtime dependencies; consumer npm installation is unnecessary.
