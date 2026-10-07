# Fork mechanism notes

These notes preserve the actual fork-authored source annotations moved during the EG-03 cleanup. Existing canonical requirements and approval records govern their applicability.

The cleanup retains upstream annotations and executable behavior. This record introduces no new ruling, owner, or approval.

## core/tools/aidlc-directive.ts

```text
// One dispatched collaborator seat on a mesh stage. The engine resolves the
// contribution path and identity marker here so the lead dispatches against the
// same triple the completion-evidence check refuses on — a brief and a refusal
// that derive paths independently agree today and diverge later, and only the
// refusal path is exercised on a failing run.
```

```text
// The unit this seat covers on a per-unit stage; null on a stage-level one.
```

```text
// ensemble_dispatch — the seat calls a mesh stage owes, emitted as DATA
// rather than left to protocol prose the conductor may skim. Present only on
// modes whose seats are dispatched (mob; agent-team when its transport
// activates). Each row names the agent, the file it must write, and the
// identity marker that file's first line must carry — the same triple the
// completion-evidence check refuses on, so dispatch and refusal cannot
// disagree about what is owed. The refusal already existed; a refusal with no
// matching dispatch is a trap rather than a protocol.
```

```text
// A dispatched seat row names its agent, where that agent writes, and the exact
// first line making the file count. All three are checked: a row missing any one
// of them is a dispatch the completion check later refuses for a reason the brief
// never stated.
```

## core/tools/aidlc-graph.ts

```text
// approval_mode — how this stage's approval gate is cleared (human | autonomous).
// Absent -> human. Parsed from stage frontmatter and carried onto the compiled
// node so the approve handler's presence guard can read it.
```

```text
// Authored frontmatter number/name are the topology source of truth (rin
// drift 019f7492): a stage that declares them fully determines its own
// placement from source, so a clean-room compile (no prior stage-graph.json)
// reproduces the graph. Upstream's pinned-row / topological-seed machinery
// remains the fallback for stages that author neither.
```

## core/tools/aidlc-init.ts

```text
// Overlaying consumer files lets the candidate compile its complete
// graph. It does not grant core ownership of those files on this or a
// later refresh, nor permission for regeneration to overwrite them.
```

## core/tools/aidlc-lib.ts

```text
// `bun:ffi` is a BUN-ONLY builtin, and a static import of it makes this module
// unloadable under Node — the import is resolved at load time whatever the
// platform, so every Node consumer breaks even where the FFI is never reached.
// This module is imported directly by Node-run tests (vitest), so an eager
// import takes the whole suite down with "Cannot find package 'bun:ffi'".
// The FFI is used by ONE Windows-only function whose call sites are already
// lazy; deferring resolution to that function keeps them synchronous and leaves
// runtime behaviour under Bun unchanged.
```

```text
// approval_mode — how this stage's approval gate is cleared. Absent -> "human"
// (a typed human turn is required, per the presence guard in aidlc-state.ts).
// "autonomous" clears the gate without that turn (its approval is gated by a
// mechanism other than live human presence). Authored per-stage in frontmatter.
```

```text
// baseRuleDelivery: strict, and FAIL-CLOSED to "explicit". An unrecognised
// or absent value must mean "transport the base layers" — the pre-existing
// behaviour — because the failure directions are not symmetric: a harness
// wrongly treated as explicit re-sends text it already has (wasteful), while
// one wrongly treated as ambient loses its method entirely (broken).
```

```text
/**
 * Whether this harness loads the base method layers itself on every turn.
 * "explicit" (the fail-closed default) means the engine is the only channel and
 * must transport them.
 */
```

```text
// The INVOKING checkout: the working tree the session is actually running in,
// walked up from a hook payload's `cwd` to the nearest ancestor holding a `.git`
// entry. A multi-worktree session's hook FILE is pinned by the harness to the
// primary checkout (CLAUDE_PROJECT_DIR at session start), so resolving the
// project dir from the hook file's location (resolveProjectDirFromHook) points
// every hook at the PRIMARY's record — audit events, health heartbeats, and
// state reads all land in a checkout the session never touched, while the
// conductor's own engine calls resolve from the worktree. Reading the payload
// `cwd` binds hook and conductor to ONE frame of reference, not two. Returns
// undefined when `cwd` is absent (a harness that omits it) or names no checkout,
// so callers fall back to resolveProjectDirFromHook and are never worse off.
```

```text
// Resolve a hook's project dir from its payload `cwd` when present, falling back
// to the hook-file location. The single seam every payload-carrying hook uses so
// the invoking-checkout binding is defined once, not duplicated per hook.
```

```text
// Read the `cwd` field off a raw hook payload without committing to the rest of
// the shape. Hooks resolve their project dir BEFORE their own full parse, so
// this stays deliberately narrow: malformed or absent JSON yields undefined and
// the caller falls back to the hook-file resolution.
```

```text
// A GATE_REJECTED row carries two domain events under one event name: a human
// Request-Changes decision, and the revision backstop's own bookkeeping
// backfill, which tags itself `Recovered: "true"` at emission. They have
// opposite consequences for the review budget — a human rejection resets it,
// a backfill must not consume it — so they are decoded into a closed union
// here, once, rather than re-checked as an optional flag at each consumer.
// Every attempt-boundary reader asks `isAttemptBoundary`; none reads
// `Recovered`. Mirrors the exclusion `unrecordedRevisionSinceGateOpen` already
// makes for its own anchor in aidlc-state.ts.
```

```text
// Only a human Request-Changes decision bounds a review attempt. Flooring on a
// backfill consumes a budget that, by the engine's own refusal text, only a
// human rejection can restore — closing both exits and leaving the record
// unable to complete its gate.
```

```text
// Only a recovery that was taken FOR the source cause spends the source
// budget. An artifact-caused recovery (declared, or derived from the rows
// for a pre-`Recovery Cause` request) leaves it available; an ambiguous
// reading still spends it, keeping the fail-closed default.
```

```text
// Pre-`Recovery Cause` request: defer until this recovery's own
// verdict is seen, so the source binding either side of it can be
// compared. Resolved after the walk; ambiguity stays fail-closed.
```

```text
// The recovery's own receipt stamps the source live at completion, so
// an unchanged pair proves the source did not move across the recovery
// window; a changed or unreadable pair spends the budget (fail-closed).
```

```text
// Run telemetry the GATE TOOLING ITSELF writes — a row per stage run. With it in
// scope, the act of recording that a gate ran moved the fingerprint that same
// gate's completion check then compares against its review receipt: a stage whose
// board genuinely converged was refused for a change nobody made on the work's
// behalf, naming a source change the lane cannot see in an ordinary status
// listing because the file is untracked. Measured twice on record
// `260914-gate5-verdict-one-action`: dropping the single post-receipt row
// recomputed the fingerprint to the receipt's value exactly, on two independent
// review iterations.
```

```text
// Root-anchored, for the reason the sensor-cache comment above states and a
// Gate-4 board re-applied here: depth tolerance is NOT permission to match the
// leaf name alone. A bare `**/.gate-runs/**` would exclude ANY directory of that
// name, so an application tracking source under a dot-prefixed, framework-named
// directory (`apps/some-service/.gate-runs/fixture.ts`) could be edited or
// deleted without moving the fingerprint — the fingerprint blind to the thing it
// exists to observe, which is this defect in the opposite direction. Every writer
// resolves through `join(projectDir, ".gate-runs", unit)`, so the telemetry is
// always exactly `<root>/.gate-runs/`, and the anchored form is available.
```

```text
// Deliberately NOT expressed as "exclude ignored paths", though every path
// involved is ignored. Measured on that same tree: 312 untracked files were in
// scope and all 312 were ignored, but 309 of them are the composed engine payload
// under `vendor/aidlc-upstream/plugins/rin/`, which the source identity SHOULD
// cover. The ignore rules do not distinguish tool-written telemetry from vendored
// source, so keying on them would silently drop the engine from the fingerprint.
// The discriminator is what writes the path, not whether it is tracked.
```

```text
// True once the platform has told us the native gate API cannot be had at all —
// the FFI is absent, or no candidate library exposes the symbol. That is a
// property of the RUNTIME, not of this lock, so it cannot change by waiting.
```

```text
// Retrying is for CONTENTION — another process holds the gate and will let
// go. An unavailable API is not contention: every remaining attempt will
// fail identically, so the budget buys nothing and costs
// maxRetries * retryMs per call. Measured before this guard: a runtime
// whose FFI load threw poisoned the cache on the first attempt, after which
// each acquireAuditLock burned two full 500ms budgets (~1.03s), turning a
// 50-retry acquisition into ~57s of sleeping against a dead API.
```

```text
// The grace window exists to protect an acquirer that is mid-flight between
// mkdir(lockDir) and writeOwnerStamp. That acquirer creates its generation
// token directory BETWEEN those two steps, so a lock dir holding no token
// is not a mid-flight acquisition — it is abandoned debris from a process
// that died in the window, and no amount of waiting will stamp it. Waiting
// out the full grace for it is pure latency: measured 5s per acquisition,
// additive across every later acquirer, with no possible change in outcome.
// A dir that DOES hold a token still serves the full window, because there
// the acquisition may genuinely still be in progress.
```

```text
// The last non-EEXIST failure seen while trying to CREATE a lock dir, per lock
// dir. Ordinary contention (EEXIST) is not recorded — only the environmental
// failures that retrying cannot fix, so the refusal can say which it hit.
```

```text
// DIAGNOSTIC, and the reason it is worth keeping: EEXIST is ordinary
// contention (someone holds the lock), while any OTHER errno is an
// environmental failure — a permission, path, or filesystem problem that
// no amount of retrying can clear. Both returned null indistinguishably,
// so an unwritable lock dir presented as a busy one and burned the whole
// retry budget plus the stale window before reporting "after retries",
// naming a holder that never existed. Recording the non-EEXIST errno is
// what tells those two apart in a log.
```

```text
// Name WHY, not just that it failed. "after retries" alone reads as
// contention and sends the reader looking for a holder — which is wrong
// and expensive when the real cause was an unwritable lock dir. The
// owner stamp (when one exists) names the actual holder; the recorded
// errno (when one was seen) names the environmental failure instead.
```

```text
// A GATE_REJECTED row carries two distinct domain events under one event name:
// a human Request-Changes decision, and the revision backstop's own bookkeeping
// backfill, which tags itself `Recovered: "true"` at emission. Only the human
// decision is an attempt boundary. Flooring on the backfill consumes a review
// budget that, by the engine's own refusal text, only a human rejection can
// restore -- closing both exits and leaving the record unable to complete its
// gate. This is the same hazard `unrecordedRevisionSinceGateOpen` already
// excludes for its own anchor (see aidlc-state.ts: a Recovered row is report's
// approve-time backfill and never the anchor); the review floor needs the
// identical exclusion.
```

```text
// A missing graph is the clean-room / first-compile case, not an error:
// compileStageGraph seeds an empty graph and derives every stage's topology
// from authored sources (frontmatter number/name, else auto-seed). Returning
// [] here is what lets a truly-empty tree build. Any other read failure
// (permissions, corruption) still throws.
```

```text
//
```

```text
//
```

## core/tools/aidlc-log.ts

```text
// Count requests in the current stage/unit attempt. The same chronological
// floors used by receipt freshness reset the budget on workflow start, jump,
// stage re-entry, or gate rejection. A matching BOLT_STARTED is a stronger
// per-unit floor because the forked audit inherits the main workflow's prior
// rows; it is also the proof that `--unit` belongs to an actual Bolt attempt.
```

```text
// Both widths are real: a git tree sha1 (40) from the single-repo path and a
// sha256 digest (64) from the multi-repo fold. Admitting only one silently
// sent every value of the other width to the fail-closed reading.
```

```text
// Classify a pre-`Recovery Cause` recovery request from the evidence it already
// carries: the preceding terminal receipt and this request each record an
// artifact fingerprint, and the receipt records the source fingerprint the
// reviewer was bound to. Whichever of the two moved across that interval is the
// cause the recovery was for. This is a derivation from committed audit rows,
// not a judgement — and where the rows cannot decide (a fingerprint missing or
// malformed, or BOTH moved) it returns the ambiguous reading so the caller
// keeps latching both budgets.
```

```text
// Defensive, and deliberately not unit-tested: a row whose artifact
// fingerprint is absent or malformed is rejected by
// `reviewRequestBindingFromBlock` before it can reach here, so no legitimate
// audit input drives this arm. It exists so a future caller that bypasses
// that filter still fails closed rather than widening a budget.
```

```text
// Requests written before the request-side source binding existed carry no
// source field, so compare the two RECEIPTS instead. A receipt stamps the
// source live at completion, so had the source moved before this recovery
// ran, the recovery's own receipt would carry the new value; an unchanged
// pair therefore proves the source did not move across the whole window.
// Only available once the recovery's verdict was recorded — which is exactly
// the wedged population, where the NEXT request is the one being refused.
```

```text
// AUDIT_MERGED is referee merge plumbing (main-emitted, merge
// protected); it carries no reviewer authority and cannot make the
// tie ambiguous for this unit's lifecycle accounting.
```

```text
// The artifact and source freshness causes hold INDEPENDENT single-use
// recoveries. A merge-forward invalidates the source binding without
// touching a declared artifact, so collapsing both into one latch made a
// first merge spend the only recovery and a second terminal — reserved to a
// human GATE_REJECTED — for an event that changed nothing a reviewer judged.
// A recovery request carries its own `Recovery Cause`; a request predating
// that field (null cause) spends both, which is the fail-closed reading.
```

```text
// Predates the Recovery Cause field. The rows still carry the
// evidence to classify it, but the receipt-to-receipt fallback needs
// this recovery's own verdict, which appears later in the stream —
// so record the inputs now and resolve after the walk.
```

```text
// Each cause holds its own single-use recovery, so a merge-forward
// (source) never consumes the artifact recovery and vice versa.
//
// The recovery REQUEST is what dispatches the board against the new
// tree, so it cannot itself require a verdict already bound to that
// tree — that ordering is circular and would make the evidence
// unobtainable. The guarantee is enforced where it can actually hold:
// REVIEW_COMPLETED refuses unless the workspace source still matches
// the source the reviewer was dispatched against, so a recorded
// verdict is re-bound by construction.
```

```text
// The artifact half of the two-latch recovery model. Upstream's
// accounting latches only the source cause, so the artifact cause is
// derived here from the same attempt window; collapsing the two would
// let a merge-forward spend the document recovery.
//
// The window is resolved HERE rather than read from an outer binding:
// the one bound near the top of handleReview lives inside reviewSlot's
// arrow body, which closes before this branch, so reaching for it threw
// `attemptWindow is not defined` at runtime while type-checking clean.
```

## core/tools/aidlc-orchestrate.ts

```text
// A mesh stage emits its seat calls as DATA. The rows resolve through the same
// helpers the approval refusal reads, so what is dispatched is exactly what is
// later demanded — and the declared mode drives the stage instead of naming a
// topology nothing acts on.
```

```text
// rules_in_context names every layer that GOVERNS this stage, including base
// layers whose text an ambient harness delivers and the engine therefore does
// not transport. "Which rules apply" and "which text this directive carries"
// are different questions; deriving the manifest from the transported content
// collapses them, and a deduped layer then reads as inapplicable.
```

```text
// The identity marker a contribution file's first line must carry. ONE
// definition, read by both the dispatch emitter and the completion-evidence
// refusal: a seat told to write one marker while the check demands another is a
// stage that can never be approved, and two derivations would drift apart
// silently because only the refusal path runs on a failing run.
```

```text
// Where a stage's contribution sets live. Shared so the dispatch emitter resolves
// the same directories the refusal reads.
```

```text
// The seat calls a mesh stage owes, resolved to concrete paths and emitted onto
// the directive. Without this the mode reaches the lead as a word in a field it
// has read a hundred times, and the instruction that would make it act lives only
// in protocol prose the lead may skip.
```

## core/tools/aidlc-sensor-verdict.ts

```text
// Sensor fire verdicts: the dispatcher's outcome type, the verdict line it
// prints, and the readers that parse that line back. Side-effect free so the
// PostToolUse hook, the gate-time reader and tests can import it without
// loading the dispatcher's bundled sensor manifests.
```

```text
// The shape a reader accepts: writer_notice is carried through unvalidated so
// a malformed notice degrades to a silent finding instead of an unreadable
// verdict.
```

```text
// Scan from the last line so a banner a wrapper printed first is skipped.
```

```text
// Not JSON; keep scanning.
```

```text
// The detail file is missing. A finding the writer can still be told about
// stays failed; one with nothing to tell keeps the historical pass-with-note.
```

```text
// The terminal audit row follows the verdict's result, so the audit and the
// verdict line never disagree about a fire whose detail file was not written.
// The fire's identity fields are the caller's to add.
```

## core/tools/aidlc-sensor.ts

```text
// --- 8. Machine-readable verdict for gate-boundary enforcement. A failed
// outcome whose detail file could not be written stays failed when it
// carries a writer notice, and otherwise drops to pass-with-note. ---
```

```text
// --- 9. Lock window B — emit terminal row matching the verdict ---
```

## core/tools/aidlc-stage-schema.ts

```text
// approval_mode — how this stage's approval gate is cleared. "human" (the
// default when absent) requires a typed human turn since the gate opened, read
// by the human-presence guard in aidlc-state.ts. "autonomous" clears the gate
// without that turn — for a stage whose approval is gated by a mechanism other
// than live human presence (e.g. an emitted, work-bound review verdict on a
// scheduled run). Names the presence axis on the stage itself so any scope can
// declare it, rather than deriving it from a workflow-wide autonomy flag.
```

```text
// approval_mode — optional closed union (human | autonomous). Absent -> human
// (the default the human-presence guard applies). Mirrors `mode`'s validation:
// a type error is reported by checkString, an out-of-union token by checkEnum.
```

## core/tools/aidlc-state.ts

```text
// One verdict-line guard, shared with the PostToolUse hook's reader.
```

```text
// rin drift (01a09df2, the method layer IS the deliverable): the layered practice
// files under a space's `memory/` directory are a rules-layer record's entire
// output, and the `rin-harness` scope's own escalation tripwire routes any change
// touching them INTO the full rin-gates lane - a bare path test that states no
// ground, but whose effect is to treat that surface as warranting every gate.
// Gate 4 then refused that same change as planning-docs-only, because
// the first-segment test below collapses the whole `aidlc/` tree to "doc". The two
// rails contradicted each other: the only routes through were the env bypass or a
// decoy commit touching an unrelated real-source path, and both corrupt the very
// signal this guard exists to produce.
```

```text
// The anchor is space-relative and POSITIONAL rather than a bare "a segment named
// memory" test: a loose test would admit a `memory/` directory anywhere under
// `aidlc/` - including inside a record dir - and record-dir artefacts are exactly
// what must keep declining, or the guard stops distinguishing "produced the
// deliverable" from "wrote its own planning docs". Stage diaries are files NAMED
// `memory.md`, never `memory/` directories, so they cannot satisfy this by
// construction.
```

```text
// The shape comes from `memorySegmentsForSpace`, the engine's own single source of
// truth for the method-layer layout, rather than from literals repeated here - its
// doc comment exists so the resolvers "can never drift from the compile/display
// family's layout", and a second hand-written copy is exactly that drift. The space
// segment is positional because any space qualifies; the surrounding segments must
// match the canonical shape.
```

```text
// Scoped so the fail-closed property is untouched: this widens the doc set's one
// wrong verdict and changes no other path's answer. A genuinely empty implement
// stage still declines every check.
```

```text
// Derived inside the guard, not at module level: main() runs at module load far
// above this point, so a module-level binding here sits in its temporal dead zone
// for every dispatch that reaches the predicate - the #891 hazard.
```

```text
// The canonical shape is built from the INPUT's own space segment, which makes the
// comparison TOTAL: every position is compared, so there is no wildcard position
// to locate and no sentinel whose non-collision would have to hold. Any space
// qualifies because the shape is built with that space's own value; a path whose
// surrounding segments do not match the layout fails on those segments instead.
```

```text
// framework file - OR when it is a space's method layer, which is a deliverable
// rather than a doc. Mirrors HARNESS_DOC_DIRS, the same set the FS walk skips.
```

```text
// rin drift (019f750a, verification-gate walk): the run-to-merged conductor drives a
// Slice whose implementation may have landed in an EARLIER in-branch commit, then
// commits the gate's record-dir artefacts (doc paths) AFTER it. That pushes the real
// source commit outside the HEAD~1..HEAD window, so the last-commit check below wrongly
// concluded "no recent code" and refused the Gate-4 approve. This helper widens the
// signal to the whole branch walk: any non-doc commit since the branch diverged from
// the trunk (origin/main) counts as real source work for this gate. Fail-closed is
// preserved — a branch with only doc commits since the base still yields false. Reverts
// when upstream honours implementation-ahead natively; see UPSTREAM-DRIFT.md 019f750a.
```

```text
// rin drift (019f98fb, already-merged implementation): every check above is a window
// ENDING at HEAD and BEGINNING at or after the branch point. When a Slice's
// implementation merged to trunk in an EARLIER pull request, a freshly-cut branch's
// merge-base sits AFTER those commits, so the source is outside all three windows by
// construction — the branch legitimately holds zero source work. The guard is then
// factually right about the branch and wrong about the Slice, and no HEAD-anchored
// window can fix it. Three Slices parked on exactly this.
```

```text
// The evidence this looks for is a commit REACHABLE FROM origin/main that touches BOTH
// this stage's own artefact dir AND a non-doc path. That conjunction is the whole safety
// argument: merged history alone proves nothing (every record's gate artefacts merge),
// and non-doc history alone proves nothing (every brownfield repo has source). Only the
// CO-TOUCH shows this record's implementation landed, and it cannot be minted by the
// completing run — it requires an already-merged commit authored by a prior PR.
// Fail-closed on every ambiguity: no record dir, a record dir outside pd, an unreadable
// log, or no co-touching commit all yield false and leave the guard exactly as strict.
```

```text
// The record-side half is scoped to THIS STAGE'S OWN artefact directory, never the record
// root. Measured on real history (2026-08-21): a repo-wide ranking sweep touched 261
// records' `importance-binding.json` alongside unrelated `plugins/` source, and a
// record-root test read that as implementation evidence for a Slice it never implemented.
// The implementing commit is the one that writes the stage's own artefacts beside the
// source; record-root metadata churn is not implementation and must not count.
```

```text
// The guard's total boundary. `mergedRecordCoTouchesSource` answers the
// "was this actually implemented" question and is fail-closed by construction —
// every ambiguity already yields false. This wrapper extends that discipline to
// the one case the guard itself cannot express: an unexpected throw. A gate that
// throws refuses nothing and blocks everything, so the throw is captured, the
// reason is carried for the caller to surface, and the verdict stays NO.
```

```text
// Declared inside the guard for the same TDZ reason as skeleton stance and
// construction iteration: main() runs at module load, far above this point in
// the file, so a module-level const here is uninitialised when an approve or
// gate-start dispatch reaches the guard. This path is the LAST fallback — it
// runs only when a records-only tip has declined every earlier check — so the
// dead-zone throw surfaced as a Gate 4 that was unavailable rather than strict.
```

```text
// resolved HEAD~1 whose last commit is doc-only, WITH no branch-since-base source
// work either, returns false (a real "no recent code", e.g. a brownfield clean
// tree), so the guard still refuses.
```

```text
// Last commit doc-only: before refusing, widen to the branch walk (rin drift
// 019f750a) - the verification-gate pattern where impl landed earlier in-branch.
```

```text
// Last: the already-merged implementation case (rin drift 019f98fb). Evaluated
// only after every in-window check has declined, so it never shadows them.
// Total at this boundary: the guard answers "was this actually implemented",
// and an answer it cannot compute is a NO, never an unavailable gate. A throw
// escaping here refuses nothing and blocks everything, which is the opposite
// of fail-closed.
```

```text
// An unavailable guard and an honest NO both refuse, and the refusal text is
// identical — so without this line an engine fault reads to the operator as a
// correctness verdict about their work. The verdict stays fail-closed; only
// the diagnosis is surfaced.
```

```text
// HEAD~1 resolved, the last commit was doc-only, AND no branch-since-base source
// work: a definitive "no recent code" (e.g. a brownfield repo whose src/ predates
// this session), so return false to refuse - the FS fallback would wrongly pass on
// the pre-existing src/.
```

```text
// Human-presence guard: a gate cannot be approved unless a real
// human acted at THIS gate since the last gate resolution. Runs BEFORE any
// mutation so a refusal (error() -> exit) leaves state untouched (same slot
// as the artifact guard above). Carve-outs FIRST, each naming one input to the
// single question "does clearing this gate require a live human turn?":
//   - autonomous Construction (swarm / Bolt), a workflow-wide runtime grant;
//   - the stage's own approval_mode: autonomous (a per-stage declaration, for a
//     gate whose approval is bound to a mechanism other than live presence);
//   - the suite-wide deterministic test off-switch.
```

```text
// skip the presence check — autonomous Construction has no human at the gate
```

```text
// skip — the stage declares its approval is cleared without a human turn
```

```text
// skip — suite-wide deterministic off-switch (AIDLC_SKIP_HUMAN_PRESENCE_GUARD)
```

```text
// Ledger-event presence check: refuse unless a HUMAN_TURN event was appended
// AFTER the last gate resolution (GATE_APPROVED / GATE_REJECTED /
// QUESTION_ANSWERED) in ledger order - the boundary is the prior resolution,
// NOT this gate's open event (one human turn drives both open and approve).
// Cascade-safety + freshness fall out of order; no marker file / turn counter.
```

```text
// A reviewer-bearing stage must satisfy the same summary-confirmation and
// reviewer preconditions the recovered gate re-entry would otherwise assert,
// and they are checked BEFORE the backfill rather than after it. The receipt
// window floors on GATE_REJECTED, so a check placed after the backfill demands
// a receipt postdating a rejection this very transaction is minting — a
// receipt no caller can hold, making refusal the only reachable outcome and
// leaving the record durably [R] with an incremented Revision Count for a
// re-entry that never emitted. Checking first asks for the strongest receipt
// actually obtainable and keeps a refusal total: the record is untouched.
// Skipped under the off-switch, in autonomous Construction, and on a stage
// declaring approval_mode: autonomous — all three describe a gate with no
// human at it, and this backstop exists solely to reconstruct a HUMAN's
// unrecorded revision. The two autonomy carve-outs (autonomousDecision,
// approval_mode) are shared with the presence and offered-choice checks
// above; the off-switch here is the backstop's OWN deterministic switch
// (revisionBackstopDisabled), not the presence-guard switch — the backstop
// asks a different question, so it carries its own kill switch.
```

```text
// Check BEFORE mutate (same contract as the artifact guard above): both
// preconditions of the recovered gate re-entry run while the record is still
// untouched, so a refusal (error() -> exit) cannot leave the record carrying
// [R] plus an incremented Revision Count for a re-entry that never emitted.
// They are re-checked against the pre-backstop `content`; neither reads the
// checkbox state or Revision Count this branch would change.
```

```text
// The summary-confirmation and reviewer preconditions already ran BEFORE the
// backfill above (rin drift: a receipt postdating a rejection this
// transaction mints is unobtainable, so checking after made refusal the only
// reachable outcome). Upstream's sensor and pipeline-link checks have no such
// ordering hazard and stay here.
```

```text
// Offered-choice check, mirroring approve's: the same question, so the same
// three carve-outs — autonomous Construction, the stage's own approval_mode:
// autonomous, and the deterministic off-switch. A gate with no human at it
// cannot source the human-shaped "Request Changes" string this demands.
```

```text
// Presence check, mirroring approve's: the stage's own approval_mode joins
// autonomous Construction as a carve-out, since neither has a human at the
// gate to supply the turn. recoveryResetNeedsHuman deliberately OVERRIDES
// both — a spent stale-receipt recovery re-requires a real human before
// GATE_REJECTED may reset review accounting, and that override is the reason
// this condition cannot simply reuse the approve-side shape.
```

```text
//
```

```text
//
```

```text
//
```

```text
//
```

```text
//
```

```text
//
```

## core/tools/aidlc-steering.ts

```text
// The BASE method layers — the space `memory/` files. On a harness that loads
// these itself every turn (`baseRuleDelivery: "ambient"` in harness.json),
// re-transporting their text tells the session nothing it does not have; the
// steering bundle carries the reference instead, and the stage delta becomes
// the only thing in the payload. On an "explicit" harness the engine is the
// ONLY channel, so they travel in full.
//
// Why this is a declared harness lever and not a heuristic: the failure
// directions are not symmetric. Wrongly treating an ambient harness as explicit
// re-sends text it already has; wrongly treating an explicit one as ambient
// drops its method entirely. So it fails closed to "explicit", and the value is
// read from harness config rather than guessed from prose or the harness name.
```

```text
// The file is READ before this filter, deliberately: an unreadable or
// non-UTF-8 rule must still fail the stage, so skipping its transport never
// weakens the integrity check — it only stops re-sending text the session
// already holds through the harness's own include.
```

## core/tools/aidlc-tiers.ts

```text
// Judgment work pins the top general model explicitly (`opus` resolves to
// the current Opus generation) rather than inheriting the session. Inherit
// is right where the session model IS the ceiling you want fanned out to
// every sub-agent; it is wrong where a fan-out of many judgment lenses off a
// high-tier session would multiply cost without bound. An explicit alias
// keeps the top tier where judgment needs it AND makes the per-seat cost
// knowable. The omitted effort key still follows the session effort.
```

```text
// The pattern-following tier. It currently shares balanced's smaller-model,
// reduced-effort projection, but remains distinct so either can be retuned.
// rin keeps concrete pins here where upstream 2.9.0 moved to `inherit`:
// inheriting the session model is what silently doubled review cost.
```

## core/tools/aidlc-usage.ts

```text
// RIN DIVERGENCE, same class as drift-register entry 18 one file over. 2.9.0
// introduced this mutex with a STATIC `import { dlopen, ptr } from "bun:ffi"`
// and resolved the library at MODULE SCOPE. Both are unloadable under Node: the
// import resolves at load time whatever the platform, and this initialiser runs
// on import even off win32. `aidlc-lib.ts` already carries the lazy shim and
// states the reason; 2.9.0 reintroduced the eager form here, which took four
// vendor-drift suites down with "Cannot find package 'bun:ffi'" before any test
// body ran. Resolution is deferred to first use, so behaviour under Bun on
// win32 is unchanged and every other platform never loads the FFI at all.
```

## core/tools/aidlc-utility.ts

```text
// rin drift (IF-2 amendment, 2026-07-17; reverts when upstream 019f7051
// lands): a PARKED workflow is not live, so it cannot be stranded. The
// error text below already advises "park the workflow(s) first"; upstream
// honours only Completed/Archived, making that advice a no-op. Mirror the
// status skip on the park marker the engine's own `park` verb writes.
```

```text
// in settings.json under a hooks/ path segment (hook command paths like
```

```text
// rin's former `hooks/`-segment regex is RETIRED at 2.9.0: it guarded
// against settings.json entries naming aidlc-*.ts files that are not
// hooks (the Bash permission-allowlist entries for engine tools), and
// upstream's command-walk below excludes those structurally by collecting
// only `command` strings. The workaround's reason no longer holds.
```

