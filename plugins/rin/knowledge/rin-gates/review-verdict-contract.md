# rin-gates review-verdict contract

How a gate's decorrelated review is recorded as a verdict **deterministically**, with harness-guaranteed proof of *who* reviewed and *that each lens produced output* — the receipts pattern, applied to review.

## The determinism rule (why this shape)

A prose step ("now emit the verdict") relies on an LLM to follow it — non-deterministic. A single reviewer posting a templated body is no better: one model can type four `READY`s into a template, and nothing proves four lenses ran. Determinism comes only from a hook reading **harness-set metadata the model cannot forge**. That metadata is the subagent identity, and it is delivered to **`SubagentStop`** hooks — not `PostToolUse` (which sees only model-supplied `tool_input` + the final text, no unforgeable identity). Verified against the Claude Code hooks reference.

## The reviewer's action (real work, not a declaration)

Each lens in the gate's **minimum roster** runs as its **own subagent** — a real dispatch of that reviewer agent, never an inline voice. The lens does its review and ends its turn with its **native verdict section** — the `## Verdict` heading every reviewer agent already declares in its own definition:

```
## Verdict

NOT-READY

- src/a.ts:12 | const x = y as Foo | CD-2 | cast defeats the type
```

- The verdict token is `READY` or `NOT-READY` (closed). Findings are the lens's ordinary cited rows (`file:line | quoted code | <CD-id> | defect-named`); the extractor harvests the pipe-cited lines between the `## Verdict` heading and the next heading, and nothing after it.
- Every rin reviewer definition carries one identical instruction for this shape, and `rin-gates-lens-defence.test.ts` pins it, so a lens cannot be told a shape the extractor does not read.
- The lens does **not** name itself — its identity comes from the harness, not its own say-so.
- A lens **may** additionally emit the structured `rin-gates-lens:v1` block below; it is a precision channel (it can declare the `gate`, which the scribe cross-checks), never a requirement.

### Why the exact-string block is not the sole channel

Asking a model to reproduce an exact delimiter pair as free text is an unreliable step, and it stays unreliable however well the instruction is written — lenses malform it in several independent ways at once (closing token absent, block fenced, no HTML comment at all), and the loss is universal across reviewer agents rather than confined to a few. Pasting the exact template into every lens definition does not fix it; it is an **anti-requirement**, giving every lens a copy to drift while still not working.

Re-derive the loss from the scribe trace rather than trusting any figure:

```bash
grep -o '"reject":"[^"]*"' aidlc/rin-gates-review-scribe-trace.jsonl | sort | uniq -c | sort -rn
grep -vc '"reject"' aidlc/rin-gates-review-scribe-trace.jsonl
```

**The tool owns the verdict instead** (`rin-gates-lens-verdict.ts`), exactly as `aidlc-swarm.ts` owns the convergence verdict — the worker's claim is an input to verify, never a fact to accept. A lens is not asked to serialise anything.

**Why a lens is not simply given a recorder tool to call.** Every lens ships `tools: Read, Grep, Glob` + `disallowedTools: Task`, and that grant IS the reviewer≠author guarantee — a lens "physically cannot mutate what it judges". Granting Bash so it could invoke a recorder would hand each lens the ability to write its own `review-verdict.json`, collapsing the hole the verdict guard exists to plug. Forgery-resistance is not tradeable for serialisation-reliability.

**Why a permissive reader is still safe.** Extraction is **fail-safe toward NOT-READY**: `READY` is returned only on an unambiguous positive match with no `NOT-READY` anywhere in the verdict region. Absent, ambiguous, both-tokens-present, or unparseable all resolve to NOT-READY or null — both of which **block** the gate. A reader that is wrong can only cost a re-review; it can never manufacture an approval.

A lens that produced no verdict at all **fails loudly** on stderr (the hook still exits 0 — it is an advisory producer), because a silent discard lets losses accumulate unnoticed.

### The extractor reads a DECLARED verdict line, not a heading body

Anchoring on a `## Verdict` **heading** and reading the region strictly *below* it is too narrow: it discards two shapes real lenses produce — `## Verdict: NOT-READY` (the token consumed into the heading line, leaving an empty region) and a bold inline `**VERDICT: NOT-READY**` (no heading at all).

The reader therefore accepts a **verdict declaration line** — a heading or a bold inline declaration — and the region **includes that line**, so the token is read wherever it unambiguously sits. It remains a declaration reader, not a keyword sniffer: prose merely containing `READY` is not a verdict. The safety direction is what makes that width safe: NOT-READY is tested first and matched anywhere in the region, so a declaration naming both tokens resolves to NOT-READY.

### Every discard is loud AND durable — the discard ledger

Tracing alone is insufficient. The trace interleaves discards with every capture across thousands of entries, so "did this board lose anything?" becomes a filtering exercise nobody performs. Every discard therefore exits through one path that writes stderr **and** appends to `aidlc/rin-gates-review-discards.jsonl` — discards only, so reading it answers the question rather than starting an investigation. The causes routed through it: `no verdict in lens output`, `no active intent at invoking checkout`, `no record name or no Current Stage`, `gate has no phase mapping`, `lens gate mismatch`, `cannot resolve HEAD sha`, `verdict does not echo the reviewed head sha`, and `lens abstained with CANNOT-REVIEW`.

**A discard is fail-safe by construction**: a discarded capture is never counted toward the roster, so the aggregate is withheld and the gate refuses the approve. A discarded NOT-READY can never become a READY.

### Tree binding applies to EVERY lens, and it lives in the tool

Tree binding — a prepared worktree, a head-sha echo, and a mandatory `CANNOT-REVIEW` — applies to **every** reviewer agent, not only the PR-review lenses. Defending one gate while leaving the gates that *design* the code accepting verdicts from lenses that cannot prove which tree they read is the gap this closes; the cost of that gap is a unanimous READY from agents that never saw a diff.

The binding is enforced **in the scribe**, not restated as prose in every agent file — a requirement copied into every lens is the anti-requirement this contract already rejects. A `READY` must echo the resolved head sha (abbreviations accepted to 8 hex chars) or it is discarded; a lens that declares `CANNOT-REVIEW` is recorded as an abstention rather than read as a malformed verdict.

**The echo gates READY only, and that asymmetry is the safety argument.** An unbindable READY is exactly the incident shape — a board approving a tree it never read. An unbindable NOT-READY is a real refusal, and dropping it could only ever help a gate approve. So a READY must prove its tree; a NOT-READY is captured regardless. `rin-gates-lens-defence.test.ts` pins the contract's presence in both agent trees so a lens shipped without it fails at CI rather than silently.

## The `review-scribe` (`SubagentStop` hook)

Matched to the reviewer-lens agent types. On each lens subagent's stop it receives, from the harness, `agent_type` (unforgeable — the agent that actually ran), `last_assistant_message`, `session_id`, `cwd`. It then deterministically:

1. resolves the active intent from `cwd` (the invoking checkout — same walk-up as the autonomy gate) → the intent's record dir NAME (its identity under repo-SoR — there is no `slice-binding.json`) and the current gate (from `aidlc-state.md`); binds current `headSha`,
2. extracts the verdict from `last_assistant_message` via `rin-gates-lens-verdict.ts` — the structured block when present (precision channel, carrying a declared `gate` that is cross-checked against the resolved gate, a mismatch discarded rather than trusted), else the lens's native `## Verdict` section,
3. appends the capture — `{ lens: agent_type, verdict, findings, session_id, at }` — to the per-`{record name, gate, headSha}` **accumulation** file,
4. when the accumulation covers the **minimum roster**, every roster lens is `READY`, **and no captured finding is left undisposed** (the findings gate below), **writes the aggregate `review-verdict.json`** (`verdict: READY`, `lenses: [agent_type…]`, `emittedBy: "rin-gates-review-scribe"`, `taskId` — the field carries the record dir name, `headSha`). If any roster lens is `NOT-READY`, it writes the aggregate `NOT-READY`.

The verdict is written by the hook the moment the last roster lens stops — there is **no "emit" step** for a model to remember, and no way for one model to fake the roster (four independent subagents with four harness-set identities must actually stop). The only LLM surface is each lens's own judgement — the irreducible leaf.

## The findings gate (a READY cannot outrank its own findings)

Step 5 of the review protocol says READY requires every producing lens READY **or its VIOLATIONs resolved**. Make both clauses mechanical. If the verdict token is the sole input to the aggregate, a lens that writes `READY` above its own cited violations aggregates to `READY`, and a CLI emitter that takes `--verdict` from the caller and holds no finding state cannot refuse such a verdict even in principle — reviewer rigor then lives in every lens definition and is guarded at no step.

Both doors apply the same predicate (`rin-gates-finding-disposition.ts`, one definition projected across both trees so the doors cannot drift):

- a cited finding is **disposed** only when it carries the evidence its disposition is made of — `fixed@<sha>` (or `resolved` with a commit-ish sha), `push-back(<ground>)`, `defer(ack:<ref>)`, or `withdrawn(<reason>)` (the reviewer retracting its own finding — a fourth, self-serve disposition beyond the ratified three, named here rather than smuggled in),
- **the parentheses on `push-back`, `defer`, and `withdrawn` are load-bearing.** They delimit the author's own justification from the finding text that follows it. A shape that accepted a CD-id or a `file:line` appearing anywhere after the prefix would be satisfied by the *cited finding itself* — every finding carries both by construction — so `push-back: <finding>` would self-justify. `withdrawn` needs the delimiter **most**: the other three carry an externally checkable referent (a sha, a ground, an ack), so a fabricated one is at least a checkable lie, whereas a withdrawal is self-serve by design and the delimiter is the only check there can be,
- **a bare disposition word disposes of nothing.** The ratified set is `fixed@<sha>` / `push-back(<ground>)` / `defer(ack:<ref>)` (`rin-gate-5-review-cycle.md:110-111`) and the trailing reference is the substance, not decoration — a defer without an ack is by definition unresolved. A predicate matching the bare words would re-open, under a more credible-sounding token, the exact escape hatch this closes,
- any finding not matching a disposition shape is **live**, and one live finding forces `NOT-READY`,
- the review-scribe records the offending rows in the artefact's `blockingFindings`, so a refusal names its cause; the CLI emitter refuses to write at all and prints the rows.

**`non-blocking note` is deliberately not a disposition.** Abolishing it is the point: a finding is disposed with evidence, or it blocks. Forms like `READY | 4 non-blocking: …` or `READY (3 non-blocking notes)` are exactly what the predicate refuses — they let a board carry live findings past a gate under a token that sounds like a decision.

**The defect direction is the opposite of the extractor's, which sets the bar.** A finding wrongly read as live costs a re-review. A finding wrongly read as disposed removes a refusal that should have fired — the central failure of a refusal-only guard. So an unrecognised disposition shape resolves to **live**.

**Fail-safe in one direction only**, exactly as extraction is: findings are consulted *only* to refuse a READY and can never grant one. A NOT-READY is recorded whatever its findings say, and a malformed or absent findings list changes nothing on a NOT-READY. A predicate that is wrong can cost a re-review; it can never manufacture an approval.

## Emitter binding and complete-output reads

The emitter records the caller's verdict and requires a nonempty lens list.
Live mode records the invoking checkout's HEAD and an advisory diff digest.
A failed diff read produces an explicit failure marker rather than a digest
indistinguishable from an empty diff.

Landed mode records the pull request, reviewed head, merge commit and digest
of that merge commit's patch. Its three arguments (`--pr`,
`--reviewed-head-sha` and `--merge-commit-sha`) are required together;
a partial set cannot silently select live mode. The autonomy gate checks
merge-commit ancestry and patch digest locally. Pull-request head and merge
identity are read by the emitter; these network facts are not re-fetched by
the gate. The test HEAD/digest seams require `RIN_GATES_TEST_MODE=1` and
do not substitute for landed evidence.

Child output goes to a file descriptor instead of a bounded pipe, then returns
as raw bytes for the digest calculation. This preserves complete output rather
than accepting a truncated patch. A killed reader and a nonzero command exit
have distinct failures: one identifies incomplete output, the other the
command's answer.

Findings can be separated by newlines or semicolons. A semicolon inside
parentheses belongs to the disposition's evidence rather than separating
findings.

## Board review publication

The board bridge posts a converged verdict as a GitHub review. An audit log
establishes that reviewers ran; its truncated messages do not establish their
conclusions. Publication therefore consumes the verdict file.

The bridge accepts the emitter's live `binding.headSha` and the scribe's
top-level `headSha`. A live binding takes precedence; absence of both heads is
refused. A landed binding has a distinct refusal because it describes merged
content rather than an open pull-request head. Legacy payloads without
`blockingFindings` default to an empty list.

Posting requires the live pull-request head to equal the reviewed head and
passes that reviewed SHA explicitly as `commit_id`. A moved head requires
review of the new content; it cannot retarget an existing verdict. A standing
review at the same head governs instead of receiving a duplicate post. An
older-head review does not establish a verdict for the current content.

## Reusable R7 disposition rulings

R7 defaults to disabled. Opting in selects enforcement; consumer baseline
bootstrap remains a consumer responsibility. A reusable bootstrap facility
needs its own packaging design for consumer-owned registry inputs.

The shared configuration loader's filesystem port is a separate responsibility
from the registry-sidecar reader. R7 depends on the shared opt-in read; that
dependency does not transfer ownership of the shared loader migration to R7.

The emitter tests distill these rulings into three-column disposition rows with
five-why chains and an acknowledgment containing a semicolon. These rows test
parser structure and policy behavior; they do not assert a historical review or
operator approval. Record/task fields use the test purpose, and SHA-bearing
disposition syntax reuses the existing opaque head value from the test seam.

## Minimum roster (the coverage gate)

> **Before convening a board, resolve the roster — do not recall it:**
>
> ```
> pnpm rin-gates:review-roster
> ```
>
> It reads the active intent's Current Stage and prints exactly the lenses that
> must be dispatched — the stage slug is the roster key directly, with no
> normalisation step. Convening a partial or substituted roster is **silently
> non-productive**: the scribe captures every lens that ran, withholds the
> aggregate as `roster incomplete`, and writes no `review-verdict.json`. Real
> agents, real findings, no artefact — indistinguishable from a successful round
> until the approve is refused. Substituting one lens for another costs the whole
> round, which is why the dispatch list is derived rather than remembered.

The aggregate is `READY` only if the gate's **minimum lens set** is covered by captures and each is `READY`. It is the gate's entry in `review-rosters.json`, and every rin gate has one: a board gate's entry is its required lenses plus the synthesis lens, and a single-reviewer gate's entry is that reviewer. `defaultRoster` is a fail-safe for a gate with no entry, and no rin gate relies on it.

Extra lenses beyond the minimum are captured and also gate the aggregate. A missing roster lens ⇒ **no capture ⇒ no `READY` verdict**, deterministically — coverage is proven by harness-recorded runs, not asserted.

## Boundaries (friction only on the wrong things)

- The verdict-guard still denies any hand `Write`/`Edit`/redirect into `review-verdict.json`; the review-scribe's own fs-write is the sole writer (the same hook-write-only pattern the audit-path guard now applies to the engine's audit shard).
- **A commit MESSAGE naming the verdict file is not a write.** A guard scanning the whole Bash command string denies `git commit -m "...review-verdict.json..."` on prose describing the guard — firing exactly when a session most needs to explain why a gate is blocked, and teaching sessions to route prose around the matcher. So a **quoted** message argument to `git commit` `-m`/`-am`/`-F`, plus a heredoc body, is removed before the write-detection predicates run. The exemption is non-recomposable into a write channel on three independent grounds: only a *balanced quoted literal* is removed (under shell semantics that span is exactly the single message argument and cannot contain shell-active syntax); a `$(…)`/backtick **substitution** is never removed (it executes inside double quotes, so such a command is scanned whole); and the exemption is **verb-gated** to a leading `git commit`, so a chained `&& echo … > verdict` keeps its tail and still denies. Pinned by the over-block suite plus the unchanged V8–V17 selftest.
- **Deletion is allowed; fabrication is not.** The invariant is *a READY verdict may only be produced by the emitter* — so a command that only ever REMOVES verdicts (`rm` / `git rm` / `unlink` whose EVERY operand is a verdict path) is permitted, while anything that could WRITE one at a destination stays denied: `mv`/`git mv` between verdict paths, `cp`, redirects, `tee`, `sed -i`, and any delete chained with a verdict write. Denying deletion buys no safety: removing a verdict manufactures no authorisation — the gate still demands a real emitted READY afterwards, so the lane is strictly worse off — while the denial itself can strand a verdict permanently at a path no longer reachable. Covered by selftest cases V8–V17.
- **The scribe's accumulation is guarded like the verdict.** `aidlc/.rin-gates-review-captures/<record>.<gate>.<headSha>.jsonl` carries each lens's standing refusal at that HEAD. A refusal is retired only by **that same lens itself reporting again** at the same HEAD — and a superseding READY must additionally echo the head sha or it is discarded before it is ever appended. No other lens's READY can retire it, and no round can be erased. Wiping the file would convert "this commit is blocked by a finding" into "re-roll the board until green at the same commit" — the accumulation is therefore denied to every mutating command, including the deletion allowance above (V17). The deletion allowance is for clearing a *stale verdict*, never for clearing a *blocking finding*.

  The invariant is **a refusal cannot be ERASED by a third party**, not "a HEAD can never aggregate READY again" — the two are easily conflated, and the stronger reading is wrong. An aggregation that scans every capture ever appended lets a since-fixed round-1 refusal pin a converged board forever, wedging the gate. A board legitimately re-reviewing at the same head must be able to converge; erasure is the case this guard stops.
- **Known gap — the guard matches the literal filename, so glob and directory-destination operands are invisible to it** (`rm .../*.json`, `cp x.json .../rin-gate-6-operate/`). Pinned by V14. Defence-in-depth holds meanwhile: `block-inline-exec` denies the interpreter routes, and the autonomy gate independently requires a known `emittedBy` stamp plus a fresh `headSha`.
- The **autonomy gate** consumes the verdict and additionally requires the captured roster to cover the declared/defaulted minimum, and accepts only the `rin-gates-review-scribe` stamp.
- `reviewer ≠ author` is enforced by the captured `agent_type` being a reviewer-lens agent (not the author session), on top of the two-bot GitHub identities for the PR itself.
- STATE/TRACE and the accumulation's runtime scratch stay at the primary via the git common dir; the git-tracked verdict rides the invoking checkout.

## What this replaces

The LLM-run `pnpm rin-gates:review-verdict` emitter (a remembered command) and the single-reviewer `gh:review`-body capture (a self-declaration with no identity proof) are both subsumed: the verdict is now a hook-captured byproduct of real, identified lens subagents completing.
