# Rin fork differences from upstream

## Repository automation

The fork removes upstream's `.github/workflows/ai-pr-review.yml` by operator choice. CI does not launch review agents, assume a Bedrock review role, or publish agent-generated reviews.

The fork also removes upstream's other workflow files and owns its `.github/workflows/rin-ci.yml` separately. Pull requests run, as parallel Linux jobs on GitHub's standard hosted runners (free for this public repository): the source checks (frozen install, one package build, type checking, lint, the Rin constitution audit and carve-out decay); the two-build package determinism check; the deterministic smoke, unit (eight shards) and integration tiers with every live-model gate closed (`--no-llm`), with the scope runs and guard matrix in their own jobs; the Rin plugin suite and derivation self-test; and Gitleaks and Semgrep. A new push cancels the older run. Job time limits are backstops to be tightened from measured runs. The workflow is verification only: it has read-only repository permission, uses no secrets, uploads no artifacts or SARIF, and has no scheduled previews, push-triggered jobs, release or tag pipelines, package publication, documentation deployment, live-model or harness shards, cross-OS matrix, merge queue or review agents. How the fork publishes is undecided, and none of upstream's publishing workflows are restored. Agents therefore do not run the determinism check, the test tiers or the scanners locally as a routine step; a red job on the pull request is the signal. Running them locally remains useful when diagnosing a failure or changing the packager. The fork's `AGENTS.md` instruction differs from upstream's in exactly this respect. This is a local repository policy, not an upstream candidate.

Tests that asserted the removed upstream workflow YAML are retired with those workflows. Tests of the retained installer, release planner/publisher, version grammar, review tools and prompts remain. The test tiers run those tests against fixtures (including the fake `gh` under `tests/fixtures/bin/`). No job runs the release or review tools against a real host, and none could publish: the token is read-only and is not persisted into the checkout.

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
| 22 | Explicit `config --refresh-open-workflows` permits compatible payload refresh without closing a concurrent pipeline. The fork still refuses an ordinary refresh while workflows are open. Upstream now allows ordinary open-workflow refresh, which does not establish equivalent compatibility and rollback checks. | `aidlc-init.ts`, `aidlc-refresh-rules.ts`, `aidlc-refresh-compatibility.ts`, `aidlc-stage-refresh-contract.ts`, existing Plan Approval owners; existing project installations. | Same state schema and compiled stage/scope completion obligations; workspace data read-only; ownership conflicts retained. Existing advisory gate sensor coverage may expand only when a bounded literal-directory union proves every prior branch remains covered; unknown glob semantics, removals, identity, severity and policy changes still refuse. Only the exact known Code Generation engine-question declaration is adapted, with the existing Plan Approval owner protecting retained prompts, target/attempt binding and answers; arbitrary prose changes remain strict. Affected targets use existing review and approval checks, while historical evidence and unrelated backlog remain intact. Candidate graphs and runners use exact retained default-space rule bytes; read-only refresh preserves missing inputs, while ordinary refresh retains normal seeding. Rule file membership and raw-byte hashes are captured before compilation, bound into plan approval, and rechecked before planning and under the existing transaction lock alongside compatibility metadata. Independent Claude/Codex rule-chain, runner, update/restore and stale-token regressions pass; focused input edit/add/remove, locked refusal, missing/seed and link-boundary cases pass. Existing schema/contract refusal and interrupted-transaction rollback coverage remains. | Upstream supplies equivalent safe refresh for independent workflows. This is intentional workflow-policy divergence, not a blanket force bypass or state-migration engine. |
| 1 | Plugin selection honors parked workflows, matching the engine's advised remedy. | `core/tools/aidlc-utility.ts`; consumers disabling core/plugin scopes. | Park then select without stranding live work; build, focused selection rerun pending. | Upstream honors parked workflows or supplies an equivalent supported transition. |
| 2, 3, 3a | Implementation evidence recognizes earlier branch work, already merged stage/source co-touches, and the workspace method layer. | `aidlc-state.ts`, `aidlc-graph.ts`; stages requiring workspace work. | Reject documentation-only evidence and unrelated record sweeps; accept genuine implementation/method output. Build; consumer evidence regressions pending. | Retire each recognition independently when upstream supplies it with equivalent scope. |
| 4, U1 | Graph topology is authored and compilation works without a committed generated seed. | Core stage frontmatter, graph loader/compiler; clean installs on every harness. | Empty generated tree builds the intended graph. Deterministic build passed. | Upstream regenerates equivalent topology from maintained source. Reconcile authored numbers rather than delete necessary topology. |
| 5 | Optional per-stage `approval_mode` is carried through schema, graph, approval/rejection, emitted stage directives, audit answer-mode projection and every conductor/worker consumer. Lifecycle verification remains separate from human participation; failed checks precede mutation. | Core workflow and directive tools, shared protocols and every harness skill; stages explicitly opting in. | Autonomous stages add no routine interview or human learnings/approval ritual and fabricate no human reply. Automatic completion cannot exercise the person-only unfinished-review exception; an explicit person approval still validates the real reply. Default human stages and genuinely reserved operator decisions still require real replies; reviewer, sensor, freshness and declared summary requirements remain enforced. | Upstream adopts equivalent per-stage semantics across every emitted and consumed decision path. Check-before-mutate has an independent retirement condition. |
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

Include newly emitted fields, new adapters and new consumers even when the
original symbols and merge anchors remain unchanged. Follow each invariant
from configuration and resolved stage policy through directive serialization,
adapter transport, conductor and worker instructions, enforced receipts and
the final mutation. Check paired default, opted-in and reserved-human cases.
A backend approval-path test is not proof that a newly emitted question,
learning or gate directive preserves the same participation policy.

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

## Consumer lint script — upstream candidate (2026-10-12)

Capability ID: `consumer-lint-script`. Producer owner: public core
`core/tools/aidlc-sensor-linter.ts`; regression:
`tests/unit/t-consumer-lint-script.test.ts`. Classification: **upstream AIDLC
candidate**, not a Rin-only lint policy. Consumer package scripts, manager,
working directory and ESLint/Biome rule configuration remain consumer-owned.

The producer baseline is merged `158c4eafb027858ebc8d40765cffd449c448f428`,
with upstream comparison pin `7a61fa7b2bca5bc701ab0a7e6ca3608df8f4694f`.
Read-only remote verification on 2026-10-12 confirmed fork main at that merged
pin. The available fork history contains no `scripts.lint` delegation in the
linter tool. Rin's retained requirement is owned by
`260816-intent-260816-sensor-lay`, absorbing capture `01a0e685` on 2026-09-28;
its facts S-8 and the linked `260927-sensor-verdicts-reach-la` S-17 describe the
ESLint sensor returning unavailable instead of running Biome. The existing
format sensor is intentionally formatting-only. This correction restores the
bounded lint delegation; it does not close the broader sensor-layout intent
or add the requested safe-fix policy.

Current upstream head checked at
`6ed7b3330c48b4664124cdf2525cea162990aed2` still invokes ESLint directly.
[Upstream issue #2202](https://github.com/awslabs/aidlc-workflows/issues/2202)
tracks local ESLint version/config compatibility and unverified-pass audit
semantics. Its newer local-ESLint repair is a distinct capability: it does not
invoke an arbitrary consumer lint script. No upstream issue, PR, acceptance
or publication is claimed for this candidate.

The correction prefers a non-empty `scripts.lint`, chooses npm/pnpm/Yarn/Bun
from the explicit flag, selected manifest or selected directory's lockfile,
and runs once in the selected package directory. `--project-dir` selects a
workspace root; `--runner project` requires its script; `--runner eslint`
retains explicit legacy selection. Default auto retains the old ESLint path
only when a script is absent. Script exit status owns the verdict; nonzero,
signal, timeout and spawn failures produce failed sensor JSON. Missing-script
and selection errors remain unavailable/script-error outcomes under the
existing dispatcher, not verified lint results. No formatter, new rules,
manager installation or filename arguments are added.

Adopt by installing an exact producer build and following
`core/sensors/aidlc-linter.md` or the sensor chapter's consumer lint instructions.
For automatic workspace-root lint, launch the harness with process-scoped
`AIDLC_LINT_PROJECT_DIR=.` and `AIDLC_LINT_RUNNER=project`, plus
`AIDLC_LINT_PACKAGE_MANAGER` when needed. Direct CLI flags override those
defaults. Manifest command suffix flags are not forwarded by the existing
dispatcher.
Consumer installation and live workflow evidence remain separate from source
unit checks; the consumer's historical notes and installed files must not be
rewritten as if they already adopted this producer change.

**Removal condition:** retire this drift after an adopted upstream version
provides equivalent consumer-script selection, manager/cwd conventions and
honest failed/unavailable behavior, with these focused regressions passing.
An upstream local-ESLint resolver alone does not meet that condition. The
Rin sensor-layout owner retains its broader configuration and safe-fix work.


## CD-46 sensor transport and baseline membership

The Rin-owned carve-out decay checker recognizes the existing dispatcher's
`--output-path` / `--file-path` invocation and emits JSON with exit zero for
evaluated outcomes. Its ordinary CLI, including `--json`, still exits one on
findings or Git failures; the constitution gate keeps that blocking contract.
Core sensor dispatch and consumer command configuration are unchanged.

The checker now tests content identity against the selected base ref's tree,
rather than global object existence. Loose objects and commits outside that
tree cannot suppress changed/new carved-file findings. Unchanged legacy
exemptions and content-identical moves remain accepted, without requiring Five
Whys when R7 is not selected. Decay does not prove selected-rule paydown after
retirement. Source fixtures use the existing hermetic Git helper; live consumer
installation and workflow acceptance remain separate proof obligations.

## Codex copied-tool argv allowlist - upstream candidate (2026-10-13)

Capability ID: `codex-tool-argv-allowlist`. Owners: shared argv rendering in
`core/tools/aidlc-command.ts`, core packaging in `harness/codex/emit.ts`, and
plugin ownership in `core/tools/aidlc-plugin.ts`, with focused pure coverage in
`harness/codex/emit.test.ts` and the existing `t150-codex-packaging` suite.
Classification: **upstream AIDLC candidate**. Fork baseline
`01b36ba6a92ca1260518b63043abfe132c3cc0ea` and upstream comparison
`7a61fa7b2bca5bc701ab0a7e6ca3608df8f4694f` contain the same defective
`["bun", ".codex/tools/"]` prefix rule. Codex prefix matching compares argv
items, not directory-string prefixes: the installed CLI 0.162.1 checker
matches that directory token literally but does not allow the normal
`bun .codex/tools/aidlc.ts engine orchestrate next` command. The prior packaging
assertion pinned the defective text rather than its intended command behavior.

This was observed as adoption friction in the ordinary adopter-owned workflow
trial: a plain Codex launch used manual approvals, and real tool invocations
did not match the advertised Bun rule. Automatic approval review was a temporary
trial workaround, not the correction. Hook trust and tool-command approval are
separate host surfaces; this change does not install or activate trust.

The initial 94 top-level filenames were insufficient for Rin. Its actual
installed tools include `rin-gates/rin-gates-review-roster.ts`,
`constitution-audit/index.ts` and `hermetic-git/index.ts`. The corrected copy
projection reuses the existing recursive packaging inventory and emits exact
second-argument alternatives without an `aidlc` filename restriction. Tests,
specs, declarations, vendor/cache directories, non-scripts and invalid relative
paths are excluded. Codex plugin sync uses its existing hash-proven primitive
ownership inventory to generate `.codex/rules/aidlc-plugin-<name>.rules`;
idempotency detects older records missing the file, and deselection/pruning
removes it through normal ownership handling. Consumer rules are preserved,
and an unowned generated-rule collision refuses rather than overwriting. Equivalent
forward-slash, dot-prefixed and Windows relative spellings are explicit
alternatives; subsequent argv items remain ordinary framework arguments.
Native `aidlc engine` permission rules are unchanged. No arbitrary Bun script,
unknown filename, directory wildcard, absolute path, Bun execution flag,
`bun run` variant or shell-wrapper argv is granted by the new rule. This is an
argv allowlist in a trusted project launched from its root, not filesystem
containment or file-content authentication; the host still owns shell
command decomposition and applies its policy to each command.

Adopt after the active session finishes: regenerate from the reviewed producer
and refresh the installed project's generated `.codex/rules/default.rules`
through normal project setup, preserving any consumer-owned rules. Check the
normal direct Bun argv with `codex execpolicy check --rules
.codex/rules/default.rules -- bun .codex/tools/aidlc.ts engine orchestrate next`.
Use the ordinary manual approval mode; automatic review is not required for
these matching commands. Consumer extensions shipped as plugins receive their own generated exact-tool
policy at sync; unregistered or locally conflicting scripts remain governed
by consumer-owned rules. New shipped tools enter the next package/sync inventory
automatically; no filename list is maintained by hand. The active
mock checkout is deliberately not refreshed mid-run.

**Removal condition:** retire this drift when an adopted upstream version emits
an equivalent recursive exact-file argv allowlist plus owned plugin-tool
composition/removal, preserves the native rule and
passes the focused positive/negative matcher cases. No upstream publication or
acceptance is claimed here.


## Sensor customization adoption and stock upgrade ownership

The composer adopts already-present declared sensor additions only when
removing them reproduces the genuine recorded core stage hash. Its
`sensor_adoption` record distinguishes present adoption from historical
insertion. Other user changes remain unowned and block refresh. Selection
recognizes validated enabled installed identities before first compose, so a
contribution-only plugin can use ordinary selection.

Core ownership records preserve proof of root skill prose outside its two unique
generated table regions, allowing cross-release regeneration without accepting
edited prose. Legacy installs may establish that proof through a normal refresh
from the exact prior stock package; no ownership is reconstructed by hand.
Stock core refresh and plugin sync remain separate operations. Focused tests
cover adoption, refusal, ordered bindings, repeated refresh and cross-release
prose preservation. Live replay and native acceptance remain separate evidence.

Bounded upstream comparison on 2026-10-13: main
[`fa149d9adaeb73ca16d13f4d832875bef108cc48`](https://github.com/awslabs/aidlc-workflows/tree/fa149d9adaeb73ca16d13f4d832875bef108cc48).
The existing composed-plugin identity discovery from
[PR #1675](https://github.com/awslabs/aidlc-workflows/pull/1675) is reused.
[PR #2235](https://github.com/awslabs/aidlc-workflows/pull/2235) repairs Copilot
shared surface roots, and [PR #2241](https://github.com/awslabs/aidlc-workflows/pull/2241)
repairs Codex runner roots/implicit invocation guards; neither implements this
bounded already-present sensor adoption or cross-release outside-table ownership
proof. Source inspection of the composer, selection and refresh owners found no
equivalent for those remaining generic upstream-candidate corrections. The
folder-composition refresh concern in [issue #1591](https://github.com/awslabs/aidlc-workflows/issues/1591)
remains open; this change reuses existing ownership, inventory and transaction
mechanisms rather than adding another upgrade framework. Open-workflow refresh
policy remains a separate Rin choice. No broad upstream sync, Copilot repair,
or live upstream acceptance is claimed by this Codex adoption test.

## Validated session transport backport

The fork backports upstream [PR #2279](https://github.com/awslabs/aidlc-workflows/pull/2279), merge commit `4f815ffed560cf7b4a6f646c0229dbc3c43d464d`, for [issue #2266](https://github.com/awslabs/aidlc-workflows/issues/2266). The observed Windows preserved-intent failure is the same provenance loss: the orchestrator resolves the real Codex thread, then its state child receives a bare override and interprets it as a stale exported session when process ancestry names another chat. A successful same-intent switch cannot fix that child environment.

Internal orchestrator/state children reuse the existing `hookChildEnv` owner for an already-resolved session. Session resolution and its stale unmarked-override refusal remain unchanged. This transports existing identity; it creates no session ID, person decision, review receipt or security permission. Regression coverage includes reverse unit routing, forward change-request reporting and refusal of an unmarked stale export without a state transition. This is an established upstream fix rather than a new session-transfer framework. The backend's inability to reopen an old placement-format conversation remains a separate host limitation.
