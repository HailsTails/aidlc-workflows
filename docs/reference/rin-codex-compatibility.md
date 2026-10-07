# Rin migration: Codex compatibility findings

This is the detail for the [existing fork drift register](rin-fork-drift.md),
dated **2026-10-07**. It records the migration investigation against public
producer commit `50cda419b787644f77e8d9ec8493a1862b100fbb`. “Published” below
means present on the migration PR branch, not merged to main, released,
accepted upstream, or accepted by the consumer workflow. No upstream contact
or acceptance is claimed. The historical verification snapshot in the register
keeps its original scope and counts.

## Sources and evidence scope

Native source pins are OpenAI Codex **0.153.4**,
[`3d2ee51ca2d5db578f328aa75e20aa22c0197c9a`](https://github.com/openai/codex/tree/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a),
and **0.160.0**,
[`a956835d020762cb2b570053af06f643a11c0ecc`](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc).
Source-derived behavior is distinguished below from observed Linux CLI
0.153.4 behavior. A tagged source inspection does not establish a
source-to-binary build match or desktop live behavior. The
[dispatch-name fixture](../../harness/codex/hooks/aidlc-codex-dispatch-tool.fixture.json)
records the immutable URLs and SHA-256 values of twelve official source files
across both tags. The register's upstream AIDLC baseline remains 2.9.0;
a separate delivery investigation inspected only three relevant files at
[AIDLC `04d83c1c37ca93c21d813ae9e722a54b0f143255`](https://github.com/awslabs/aidlc-workflows/tree/04d83c1c37ca93c21d813ae9e722a54b0f143255):
`core/hooks/aidlc-deliver-stage-rules.ts`,
`harness/codex/hooks/aidlc-codex-adapter.ts`, and `harness/codex/emit.ts`.
Those files did not supply an opaque-message branch or dynamic SubagentStart
stage-rule delivery. This is not a whole-upstream audit.

The operational receipts retain native events, hook response-cache entries,
model metadata, before/after fingerprints and trust-expiry probes privately.
The public summaries below omit consumer rule contents, private checkout
paths, account identifiers and transcripts. Observed pilot results are
reported findings, not independently reproducible public transcript fixtures.

## Classification and retirement

These rows extend the existing drift account; they do not add requirements,
a new workflow, or an approval mechanism.

| Finding | Classification and current status | Owner and removal condition |
| --- | --- | --- |
| Native dispatch names and schemas | **Upstream AIDLC candidate.** Exact matcher correction published in `50cda419`; the dotted-name assumption in `19c0c878` is superseded. Both generations' distinct argument contracts must be retained. | AIDLC adapter/packager; retire when upstream supports the actual native names and distinct schemas with equivalent regressions. |
| V2 opaque-message corruption | **Upstream AIDLC candidate** for the adapter repair; encryption itself is an **upstream Codex compatibility constraint**. Live failure measured; durable delivery repair proposed, unimplemented. Published name matching does not make V2 delivery ready. | AIDLC owns preserving opaque inputs and proving an independent instruction channel. Retire only with full delivery and native handback evidence on the supported V2 route. |
| Child-start instruction transport | **Upstream AIDLC candidate** for integration; nonblocking hook failure and context spill are **upstream Codex compatibility constraints**. Source-derived channel, not a live V2 delivery acceptance. | AIDLC must resolve existing session/intent binding, complete context and evidence handling; Codex owns hook semantics. Reassess at a native version change and retire the adapter difference only after equivalent measured delivery. |
| Cloud versus native execution | **Upstream Codex compatibility constraint.** Local hook commands require a local native session; cloud tool execution alone does not exercise that hook seam. | Harness/platform boundary; remove this limitation only when the cloud execution route actually supports the same project-hook lifecycle. |
| Invocation cwd, project trust and ambient plugin | **Local setup defects.** Wrong discovery cwd, disabled project layer, incorrectly serialized trust keys and an old enabled marketplace source were diagnosed. Invocation-only corrections measured; persistent reconciliation remains pending. | Consumer operator; close after the intended checkout's normal discovery exposes only the intended, current, trusted registrations. No new persistent permission is implied. |
| Misplaced `sandbox_mode` in installed TOML | **Local setup defect** in the investigated consumer config. Root invocation overrides were measured; persistent/source correction has not been accepted or published by this investigation. | Consumer setup and, if reproduced in current generated output, AIDLC emitter. Close after strict parsing of the corrected installed/generated config; do not infer a producer fix from a tolerant parser. |
| Ephemeral V2 history fork | **Upstream Codex issue candidate / compatibility constraint.** Missing-parent-history mechanism is source-derived; a later explicit no-history dispatch succeeded. The first pilot lacks raw arguments, so its cause is not conclusively recovered. | Codex owns ephemeral history lookup. Retire after supported ephemeral history forks work on the affected route; `none` remains a bounded diagnostic choice, not a new fork default. |
| Role sandbox declaration | **Upstream Codex compatibility constraint**, plus a **withdrawn assumption** that role TOML alone enforced confinement. Root read-only correction is a measured local driver change. | Pilot/consumer owns effective root policy; Codex owns role projection and permission inheritance. Remove the declaration caveat only when actual native enforcement is established for the chosen version. |
| Codex marketplace and trust projection | **Upstream AIDLC candidates.** Marketplace emission `8df50f77` and normalized trust identity `36ad7226` published and source/discovery tested. | AIDLC emitter; retire each correction independently when upstream emits a native discoverable marketplace and trust identities matching final normalized registrations. |
| Typed runtime/declaration companions | **Upstream AIDLC candidate.** Plugin repair `c27361ee` and standalone core reuse `63810ec4` published and tested. The Rin-specific policy carried with them remains personal drift. | AIDLC packaging; retire when installed tools retain typed import paths and run without consumer dependency installation. |
| DD7 refresh proportionality | **Rin personal requirement or drift** for DD7/Five Whys policy and explicit open-workflow refresh; the coherent sensor comparison/runtime mechanism is an **upstream AIDLC candidate**. Published `a90c387b` and `63810ec4`; no DD7 waiver. | Rin owns the policy choice; AIDLC may adopt the reusable mechanism independently. Retire mechanisms on equivalent upstream behavior, and personal policy only by consumer decision. |
| Installed registration probe repair | **Local setup/acceptance defect.** Isolated consumer repair remains uncommitted; ten tests and direct installed probes pass. It is not a public producer repair or live guard acceptance. | Consumer validation tooling; retire after its supported resolver and host adapters cover installed paths without misreporting them. |
| Mandatory review context | **Upstream Codex compatibility constraint** for bounded model-visible tool output, with **local setup defects** in this review execution's oversized batches and read ordering. Call eight's native READY/capture is measured; its complete ordered preflight is contradicted by actual tool output/chronology. | Reviewer execution and bounded brief own complete ordered reads; the host owns output limits. Close with supported smaller reads verified from actual model-visible results, without changing the recorded verdict or inventing a new admission guarantee. |
| Universal pre-model admission guarantee | **Withdrawn assumption.** The investigation introduced it; canonical requirements were not changed to require it. Its absence is not a migration-wide blocker. | Investigation owner; corrected by this record. Preserve full delegated-rule and honest native-evidence obligations, without reinstating this stronger guarantee as a personal requirement. |
| V1 controller route and host alternatives | **Upstream Codex compatibility constraint** for generation-dependent dispatch; the controller choice is a local diagnostic, not a new Rin requirement. V1 full-bundle delivery and later substantive capture measured with the unchanged Terra reviewer; the latter has the context-compliance limits below. Existing Claude fallback remains available but was not newly exercised here. | Consumer owns model/allowance choices; reassess when ordinary intended-host delivery works. Do not turn a bounded controller choice into a persistent model or harness policy. |

## Native names, arguments and opaque content

The native function representation is namespace `collaboration`, name
`spawn_agent`. The cloud/UI spelling `collaboration.spawn_agent` is not the
hook's wire name. At both source pins,
[the formatter](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/tools/mod.rs)
concatenates namespace and name without a delimiter.
[The hook registry](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/tools/registry.rs)
canonicalizes the ordinary/V1 spawn to `spawn_agent` with alias `Agent`;
the namespaced V2 fallthrough is `collaborationspawn_agent`. A V2 call
without a namespace may also appear as bare `spawn_agent`, so name alone
does not prove a V1 payload.

The [published correction](https://github.com/HailsTails/aidlc-workflows/commit/50cda419b787644f77e8d9ec8493a1862b100fbb)
matches only the exact bare and concatenated forms and normalizes them at the
PreToolUse adapter seam. Broad namespace stripping is not part of the repair.
Its source-fixture and focused checks prove this mapping, not rule delivery.

V1 accepts editable `message` or structured `items`, with `fork_context`
defaulting to false. V2 requires `task_name` and `message`, uses
`fork_turns` (`none`, `all`, or a positive integer string; default `all`),
and does not accept V1's `items`/`fork_context` or invented instruction
fields. Full-history fork and named-role restrictions must retain the native
generation's behavior. V1 returns an agent reference; V2 returns a canonical
task reference. Role, model/effort, fork semantics and lifecycle identity must
survive adaptation.

The model-origin V2 `message` is opaque encrypted transport. Its human-readable
schema description does not authorize appending plaintext.
[0.153.4's route](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/tools/handlers/multi_agents_v2.rs)
and [0.160.0's route](https://github.com/openai/codex/blob/a956835d020762cb2b570053af06f643a11c0ecc/codex-rs/core/src/tools/handlers/multi_agents_v2.rs)
use different internal representations while preserving that boundary.
An internal direct-plaintext call-source exception is not a public spawn
argument or hook option.

In native investigation call six, the matching hook completed and appended
159,199 characters / 160,180 UTF-8 bytes of rule context to the V2 message.
The child failed with HTTP 400 `invalid_encrypted_content`, with
`willRetry:false`. The controller's normal completion did not make the child
successful. This identifies an AIDLC mutation defect after the name repair.
Decrypting, appending, translating to V1, or inferring plaintext from a
prefix/base64 shape is not a supported fix.

## Proposed child context and evidence limits

Both pinned tags await synchronous SubagentStart context before the child's
first regular model request; context enters as a separate developer-role item
([turn startup](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/session/turn.rs),
[context representation](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/context/hook_additional_context.rs)).
This is a source-supported candidate for transporting the bundle while
preserving the opaque dispatch input. The default approximately 2,500-token
context limit spills large output; supported `additionalContextLimit:0`
preserves the complete text
([spill implementation](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/hooks/src/output_spill.rs)).
A new handler/limit needs new reviewed trust identities; none was applied.

The child payload's `session_id` is the shared root-session identity and
`agent_id` identifies the child. Existing AIDLC session binding can therefore
resolve the parent-selected intent; an earlier claim that missing
`parent_thread_id` required a new registry was corrected. Require a valid,
matching binding and readable concrete intent/state. An ambient active-cursor
fallback is not evidence for concurrent intents. An explicit
`AIDLC_RULES_DIR` override must agree with the binding's space/root.
Session binding alone does not pin the current stage or source head.

[SubagentStart is nonblocking](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/hooks/src/events/session_start.rs):
`continue:false`, timeout, hook error, invalid output, absent context or an
untrusted handler do not universally prevent a child request. The native
`subagent_start_continue_false_is_ignored` regression was inspected, not run
as a Rust test here. V2 inter-agent delivery also bypasses UserPromptSubmit.
Parent preflight cannot guarantee against a later child-hook failure; a
child tool guard runs after model sampling. The current review scribe does not
attest complete rule delivery, so capture alone cannot prove this contract.

The canonical obligations remain full verbatim delegated steering/rules,
knowledge before substantive reviewer work, preserved existing guards and
honest native review provenance. “No child model request can ever occur if
rule admission fails” was an investigation-introduced strengthening, not an
express user requirement. It is withdrawn without editing requirements.
That correction neither approves an incomplete bundle nor earns a review.
A generic V2 adapter repair and its actual delivery acceptance remain pending;
the stronger guarantee is not a prerequisite to the whole migration.

## Execution boundary and local setup

Cloud task tools can execute commands in the Linux checkout without the cloud
orchestrator running its project-local command hooks. Direct Bun invocation,
metadata-only `hooks/list`, instruction discovery and green CI each test a
different surface. Only the intended native CLI/app-server session exercises
its actual model-tool interception and lifecycle. See the
[managed hooks documentation](https://learn.chatgpt.com/docs/hooks) and
[Codex setup guide](../guide/harnesses/codex-cli.md).
A desktop app-server process's working directory is not proof of a thread's
project cwd; no desktop UI delivery acceptance is claimed.

The investigated clone's project layer was disabled until the exact invoking
checkout was trusted. Hook hashes alone did not activate that layer.
Earlier config/read probes omitted cwd and therefore did not test project
discovery. A wrongly quoted trust identity and an enabled marketplace plugin
pointing to an old worktree were separate defects. Supported invocation-only
project trust, correctly serialized exact hook identities and exclusion of
that ambient plugin made native discovery expose exactly 33 intended hooks.
These changes expired afterward; no global marketplace or trust rewrite was
made. CLI and desktop can have separate CODEX_HOME/configuration roots.

The installed consumer TOML also placed `sandbox_mode` under
`shell_environment_policy`, rather than at root. A tolerant parse with
explicit invocation overrides did not establish valid strict configuration.
That defect still needs a scoped installed/generated-config disposition.
Normal project trust enables existing project config and exec policies;
command hooks retain ordinary user-process authority outside the model
sandbox. The read-only model sandbox does not confine those hook processes.

The ephemeral-history failure requires the same evidence discipline.
[Native V2 spawn](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs)
defaults omitted `fork_turns` to `all`;
[history loading](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/agent/control/spawn.rs)
can attempt to read an ephemeral parent's stored history and return
`no thread with id`. That was the first pilot's reported symptom, but its
saved events lacked the actual failed spawn arguments/result.
Subsequent explicit `none` produced a child. This supports the workaround
without proving every history fork fails. Positive-number forks and desktop
0.160.0 history behavior remain unmeasured; persistence was not enabled as
a workaround.

[Role projection](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/agent/role.rs)
does not carry `sandbox_mode` through AgentRoleOverrides. A role declaration
alone was therefore not proof of child confinement. Native spawn reapplies
the parent's runtime permission snapshot. The corrected pilot set the parent
to read-only; the last diagnostic returned root
`readOnly` / `networkAccess:false`. No independent child sandbox snapshot was
captured. Inheritance is source-derived evidence, not a direct measurement of
a child permission response.

## Reviewed packaging and proportional refresh

The [marketplace correction](https://github.com/HailsTails/aidlc-workflows/commit/8df50f77)
emits `.agents/plugins/marketplace.json`, retaining
`.codex-plugin/plugin.json` and other host projections. Twenty-five focused
tests, types/lint and seven-host determinism passed; CLI 0.153.4 and managed
0.160.0 model-free discovery passed. The
[trust correction](https://github.com/HailsTails/aidlc-workflows/commit/36ad7226)
seeds the actual normalized final matcher/group identities instead of raw
authored rows. Neither change rewrites consumer global configuration.

[Typed plugin runtime packaging](https://github.com/HailsTails/aidlc-workflows/commit/c27361ee)
and [standalone core companions](https://github.com/HailsTails/aidlc-workflows/commit/63810ec4)
share the existing runtime/declaration emitter, preserve authored imports and
tests, and remove the need for a consumer dependency install. Configured
build/determinism/types/lint and focused regressions passed. General mechanics
are upstream candidates; bundled Rin model, review and DD7 policies remain
consumer choices.

DD7's project-opt-in `rinGates.exceptionWhyChains` and the
[R7 repair](https://github.com/HailsTails/aidlc-workflows/commit/a90c387b)
retain adjacent Five Whys evidence for official exception claims.
The later refresh comparison excludes **only** coherently registered
`fire_on:"write"` / `default_severity:"advisory"` sensors. Paired sensor
metadata must validate, with unique IDs matching the applicable list exactly;
gate/blocking sensors and every other compiled stage/scope completion
contract stay in the comparison. This permits an advisory sensor payload
refresh under the existing explicit compatible-refresh transaction,
ownership refusal and rollback. It does not waive DD7, rewrite state, soften
a binding rule, grant autonomy, or add approval authority. Registry 22 remains
a deliberate Rin refresh-policy difference even if upstream adopts the
reusable comparison mechanism.

Separately, the isolated consumer registration probe repair resolves installed
commands from the actual project root and distinguishes host adapter payloads.
Ten tests, strict types/lint/audit, and direct installed Claude/Codex probes
(17/17 each, zero unresolved) passed. The repair remains saved and uncommitted.
Direct registrations/invocations do not prove all native guards intercept
model activity; no public producer commit is attributed to this repair.

## Bounded native delivery and review

Eight native controller invocations were consumed in this investigation batch;
**call nine is unallocated**, and the bounded run stopped after call eight.
User review is required before call ten. Earlier, separately bounded DD7 checks
are not included in that batch. This count is not a provider-request count.
No newly paid fallback was used.

Call seven used a **gpt-5.6-luna / high** V1 controller and one unchanged named
**aidlc-architecture-reviewer-agent**, whose native spawn metadata selected
**gpt-5.6-terra / medium**. Native metadata selected V1; this was not inferred
from the role's model name. [Native thread creation](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/thread_manager.rs)
and [session generation selection](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/session/mod.rs)
show child generation inherited from the parent; a Terra role does not itself
require a V2 tool generation.
Actual editable V1 arguments were `agent_type`, `fork_context:false`
and `message`; the installed hook delivered all four canonical rule texts.

The completed native spawn prompt equaled the hook cache's updated message
byte-for-byte and contained the complete canonical texts. The prompt was
160,928 UTF-8 bytes and hook output 163,118 bytes, below the 512 KiB refusal
limit. The child returned both exact bundle markers, all four top-level rule
headings and a unique generic rule quote. Native child final and wait handback
matched, and native SubagentStop recorded the real named-role completion.
Raw hook stdin, raw function events and the complete first model request were
not captured. The original observer missed V1 collaboration events; the saved
events supported a corrected receipt without another invocation.

The scribe correctly discarded the diagnostic with `no verdict in lens output`:
the prompt requested delivery evidence and expressly prohibited a review
verdict. This measured full-bundle dispatch and handback, **not** accepted
review capture, an independent workflow verdict, a gate, migration acceptance,
or permission to merge/deploy. Runtime files, native workflow state, history
and persistent global config were preserved; invocation-only trust expired.

The Luna controller was an explicitly authorized bounded diagnostic, not a
persistent Rin default or a new requirement. An existing Claude Code 2.1.267
Sonnet/medium reviewer route has its own Task/Agent delivery and native
handback capture; historical Claude evidence does not replace current Codex
acceptance. No new Claude model call was made in this investigation.

### Substantive review capture and its compliance limits

Call eight reused the same controller/role/runtime, exact 33 hook identities,
invocation-only project trust, read-only root, included account allowance and
600-second ceiling. It completed in **258.19 seconds**. The native engine
opened a fresh review request against the current revised Gate 1 artifact
bytes before dispatch. Actual child metadata verified the prescribed
architecture reviewer, Terra/medium, correct invoking checkout, provider,
parent and ephemeral session; the existing root-session binding selected the
intended migration intent. Native child input equaled the completed spawn
prompt and hook-updated message, including all four full canonical rule texts.
The 165,609-byte prompt and 167,829-byte hook output stayed below 512 KiB.

The child returned **READY, no findings**, and the real native wait delivered
that same final report. SubagentStop captured its real identity and output;
the existing scribe derived the aggregate and the engine recorded the matching
request-bound READY review receipt. This is accepted native review capture,
rather than a model-authored receipt or a fabricated positive verdict. The
scribe appended only its canonical review metadata to the requirements file;
the entire reviewed requirements prefix remained byte-preserved. It did not
approve or advance the gate. Runtime, workflow state, source HEAD and global
configuration remained unchanged, and temporary trust expired.

**That accepted capture does not establish a fully compliant review.** The
unchanged persona requires all shared knowledge to be loaded before
reviewer-specific knowledge and substantive work. The saved native sequence
read reviewer-specific knowledge after only the first shared batch, performed
artifact/FR/AC checks before the last shared batch, and then returned its
verdict. Native command events retain the full output of all 83 knowledge
files, but the actual custom-tool outputs returned to the child model
explicitly truncated seven outputs, including the last mandatory knowledge
batch and artifact reads. A complete captured command output is not proof of
complete model-visible input. Both the ordering gap and missing complete
model-visible preflight were independently checked from saved events.

The native READY and engine record are preserved as genuine historical
evidence; neither is rewritten to NOT-READY to conceal the scope problem.
No earned gate or fully compliant workflow review is claimed. The concrete
remedy to assess is ordinary smaller, ordered reads with verification of the
actual returned context, keeping the existing persona, rules, role, sandbox
and capture seam. That remedy is proposed, unmeasured, and does not allocate
another invocation, change persistent model policy, or require a universal
pre-model admission guarantee.
