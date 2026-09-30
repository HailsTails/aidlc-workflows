// rin-gates autonomy backstop (Seam B, IF-1).
//
// The rin-gates scope runs autonomously: a scheduled pipeline lane drives one
// Slice Gate(next)->merged and, as the approver, calls `aidlc-orchestrate report
// --result approved` at each gate (Seam A). Upstream AIDLC is "autonomy never
// inferred" — the human approval is conductor-persona prose, not an engine stop —
// so an autonomous lane could rubber-stamp a gate. This hook is the teeth that
// gate the lane's self-approval: on a rin-gates-scope stage completion, it
// refuses the approve unless a fresh, work-bound review verdict exists — one
// emitted by the guarded emitter (`rin-gates-review-verdict.ts`), not a
// hand-written file (the verdict guard denies free writes; Gate-5 review B1).
// The verdict binds to the record dir (the active intent) + HEAD sha +
// reviewed-diff digest, so it cannot be replayed against a later commit. Note
// the honest bound: this proves a review verdict was EMITTED for exactly this
// work, not that the review's judgement was correct — soundness of the review
// itself remains the review board's job, as with any gate. Combined with the
// constitution gate (below) hard-blocking a red audit, this makes an autonomous
// approve gated, not free.
//
// It does NOT re-check the constitution — `rin-constitution-gate.ts` (a sibling
// PreToolUse hook on the same matcher) owns the authoritative hard block on a red
// audit. Duplicating it here would only add false negatives (that ledger write is
// best-effort). This hook adds exactly one condition: the review verdict.
//
// Resolution (IF-1, decorrelated-review-corrected): scope + record dir come from
// the INVOKING checkout's active-intent cursor (the lane runs `report` in its own
// worktree; the engine set that cursor to the intent being driven) — NOT the
// primary checkout. Under repo-SoR the record dir IS the identity; there is no
// slice-binding.json to consult. The verdict is work-bound (record dir + headSha)
// so a stale-commit verdict from an earlier run at the same gate path cannot pass.
//
// TWO BINDING MODES (Slice 260816-verdict-landed-binding). The verdict now
// carries an explicit `binding` naming what the review covered, and this hook
// verifies it per mode:
//
//   - live   — the reviewed head, verified as today (equal to HEAD), plus a
//     records-only tolerance: a verdict sha that is an ANCESTOR of HEAD still
//     authorises when every path changed since then lies inside the approving
//     intent's OWN record dir. Ancestry is checked first and a failure returns
//     immediately: a diff across a divergent branch is meaningless.
//   - landed — a review of a MERGED pull request, verified from the local clone
//     alone by exactly two jointly-sufficient elements: the merge commit is an
//     ancestor of HEAD, and its own patch still digests to the recorded value.
//     Ancestry alone discriminates nothing; the digest identifies one tree.
//
// This hook makes NO network call and nothing may enable one. A hook blocking on
// `gh` would make every approve outage-bound and hand a lane a denial-of-service
// lever on its own gate. The emitter's network facts (headRefOid equality,
// merge-commit identity) are not re-verifiable here and ride the emittedBy stamp
// — the same trust bound the whole verdict mechanism already has, reused rather
// than widened.
//
// A verdict carrying no `binding` at all is read as live from its headSha (an
// older emitter wrote it); a verdict carrying neither is denied by name.
//
// Forward-compat: this is a concrete instance of upstream's reserved `blocking`
// sensor severity (issue #431) — a blocking gate consulted at the completion
// point. If upstream ships the ralph-driver blocking model, this maps onto it.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { env, stdin } from "node:process";
import { fileURLToPath } from "node:url";
import {
  phaseOfGate,
  reviewVerdictSegments,
} from "../tools/rin-gates/rin-gate-namespace.ts";
import {
  type RosterResolution,
  resolveReviewRoster,
} from "./shared-review-roster.ts";

type HookInput = {
  readonly tool_name?: string;
  readonly tool_input?: { readonly command?: string };
  readonly cwd?: string;
};

// Every shell-bearing tool this harness offers, as a closed set. An approve
// arrives through whichever the session used, and the gate authorises the
// approve rather than the transport — so a tool absent here is a silent total
// bypass of assertReviewConverged, not a narrower check. Adding a shell tool to
// the harness means adding it here AND to this hook's settings.json matcher;
// the seven sibling guards already register Bash|PowerShell.
const SHELL_TOOL_NAMES: readonly string[] = ["Bash", "PowerShell"];

const isShellToolName = (toolName: string | undefined): boolean =>
  toolName !== undefined && SHELL_TOOL_NAMES.includes(toolName);

// `binding` is deliberately `unknown`, not a structured optional type: readVerdict
// casts its JSON.parse result to this shape (inherited debt), so a structured
// declaration would make the narrowing below compiler-redundant against that cast
// and render the unknown-mode arm dead by type while still reachable at runtime.
type ReviewVerdict = {
  readonly gate?: string;
  readonly taskId?: string;
  readonly headSha?: string;
  readonly verdict?: string;
  readonly reviewedAt?: string;
  readonly lenses?: readonly string[];
  readonly blockingFindings?: readonly string[];
  readonly emittedBy?: string;
  readonly binding?: unknown;
};

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const failWith = <E>(error: E): Result<never, E> => ({
  outcome: "failed",
  error,
});

type SpawnedOutputFailure =
  | {
      readonly cause: "killed";
      readonly signal: string;
      readonly bytesWritten: number;
    }
  | { readonly cause: "exited"; readonly exitCode: number };

const describeSpawnedOutputFailure = (failure: SpawnedOutputFailure): string =>
  failure.cause === "killed"
    ? `the reading process was killed by ${failure.signal} after ${failure.bytesWritten} byte(s), so its output is truncated rather than absent — this is a reader fault, not a fault in the commit`
    : `git exited ${failure.exitCode}`;

// Declared locally rather than imported, per IF-14 of the
// 260816-verdict-landed-binding lock: the emitter is a synced twin and this hook
// is an orphan, so a shared module would need a topology this Slice would be
// inventing. The two definitions are held identical in BEHAVIOUR by lock, and
// selftest case E7 is the mechanical detector that they still agree — it runs
// both production paths over one real commit in one minted repository.
//
// Byte-for-byte the same read as the emitter's: stdout to a FILE DESCRIPTOR, so
// spawnSync's pipe-only `maxBuffer` has no ceiling to impose and the read cannot
// silently truncate. This half matters most — the gate RECOMPUTES the digest to
// admit a landed verdict, so while it carried the 1 MB ceiling a large PR's
// verdict was unapprovable even once the emitter could produce it.
const readSpawnedOutput = (input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}): Result<Buffer, SpawnedOutputFailure> => {
  const scratchDir = mkdtempSync(join(tmpdir(), "rin-gates-spawn-output-"));
  const descriptor = openSync(join(scratchDir, "stdout.bin"), "w+");
  try {
    const spawned = spawnSync(input.command, [...input.args], {
      cwd: input.cwd,
      stdio: ["ignore", descriptor, "ignore"],
    });
    const written = fstatSync(descriptor).size;
    if (spawned.status === null) {
      return failWith({
        cause: "killed" as const,
        signal: spawned.signal ?? "an unnamed signal",
        bytesWritten: written,
      });
    }
    if (spawned.status !== 0) {
      return failWith({
        cause: "exited" as const,
        exitCode: spawned.status,
      });
    }
    const output = Buffer.allocUnsafe(written);
    const fillFrom = (position: number): number => {
      const read = readSync(
        descriptor,
        output,
        position,
        written - position,
        position,
      );
      return read === 0 ? position : fillFrom(position + read);
    };
    fillFrom(0);
    return succeed(output);
  } finally {
    closeSync(descriptor);
    rmSync(scratchDir, { recursive: true, force: true });
  }
};

type VerdictBinding =
  | { readonly mode: "live"; readonly headSha: string }
  | {
      readonly mode: "landed";
      readonly pullRequestNumber: number;
      readonly reviewedHeadSha: string;
      readonly mergeCommitSha: string;
      readonly diffDigest: string;
    };

type BindingReadFailure =
  | { readonly kind: "binding-mode-unknown"; readonly mode: string }
  | {
      readonly kind: "binding-fields-incomplete";
      readonly mode: string;
      readonly missing: readonly string[];
    }
  | { readonly kind: "binding-absent-and-no-head-sha" };

const REPORT_COMPLETION = /aidlc-orchestrate\.ts\s+report\b/;
const COMPLETION_RESULT = /--result\s+(approved|completed)\b/;
// M1: the bypass is an env var (an operator override), not a substring of
// the command — a substring match let any command merely CONTAINING the token
// pass, and left no trace. Honouring it emits a loud stderr marker.
const BYPASS_ENV = "AIDLC_RIN_GATES_AUTONOMY_BYPASS";
// The two legitimate emitters of a verdict, each bypassing the verdict guard the
// same sanctioned way. rin-gates-review-verdict.ts is the CLI emitter; the
// SubagentStop review-scribe (rin-gates-review-scribe.ts) writes the aggregate
// verdict the moment its minimum lens roster is covered. A verdict without one of
// these stamps did not come through a guarded producer. The scribe path carries
// the additional roster-coverage bar below.
const CLI_VERDICT_EMITTER = "rin-gates-review-verdict";
const REVIEW_SCRIBE_EMITTER = "rin-gates-review-scribe";
const ACCEPTED_VERDICT_EMITTERS: readonly string[] = [
  CLI_VERDICT_EMITTER,
  REVIEW_SCRIBE_EMITTER,
];
const RIN_GATES_SCOPE = "rin-gates";
const GATE_5_STAGE = "rin-gate-5-review-cycle";
const SCOPE_GRID_SEGMENTS = [".claude", "tools", "data", "scope-grid.json"];

// Test seams (hermetic selftest — never spawns real git): RIN_GATES_SPACE
// overrides the space; under RIN_GATES_TEST_MODE=1 ONLY, RIN_GATES_HEAD_SHA
// injects the HEAD sha so the stale-verdict check is exercised without a real
// repo. In production (test mode unset) the env HEAD override is ignored and the
// hook reads real git — a lane cannot spoof HEAD via env (Gate-5 review H2).
const hookDir = dirname(fileURLToPath(import.meta.url));
const toolRoot = resolve(join(hookDir, "..", ".."));
const space = env.RIN_GATES_SPACE ?? "default";

// The minimum reviewer roster a review-scribe-emitted verdict must cover,
// resolved PER-GATE from the SAME shared config the scribe reads
// (review-rosters.json, beside the review-scribe hook). The scribe only writes
// once every roster lens has reported in; this gate re-verifies coverage from
// the verdict's own lenses list against the gate's roster, so a scribe stamp
// cannot stand in for an under-covered review. One config, two consumers — they
// cannot drift (the drift between them was task 019f8be9's sibling failure mode).
const ROSTER_CONFIG_PATH =
  env.RIN_GATES_ROSTER_CONFIG ?? join(hookDir, "review-rosters.json");

const reviewRosterFor = (gate: string): RosterResolution =>
  resolveReviewRoster({ configPath: ROSTER_CONFIG_PATH, gate });

// The roster floor's decision, separated from the act of refusing so both faces
// are directly assertable: a refusal message, or `null` meaning permit. The
// impure caller only chooses whether to `deny` it.
//
// IF-2's refusal contract is frozen as behaviour: name the gate, the uncovered
// lenses, and which source the floor came from — a lane reading the refusal must
// be able to act without opening the config.
const rosterFloorRefusal = ({
  gate,
  resolution,
  lenses,
}: {
  readonly gate: string;
  readonly resolution: RosterResolution;
  readonly lenses: readonly string[];
}): string | null => {
  if (resolution.kind === "unreadable")
    return `cannot resolve the review roster for '${gate}': ${resolution.reason}. A gate approval is refused when the floor cannot be read — an unreadable roster is not an empty one.`;
  const uncovered = resolution.roster.filter((lens) => !lenses.includes(lens));
  if (uncovered.length === 0) return null;
  return `verdict for '${gate}' misses roster lenses [${uncovered.join(", ")}] — the minimum decorrelated roster (from ${resolution.source}) is not covered.`;
};

// The invoking checkout: the checkout the gate SESSION is operating in, resolved
// from the hook's stdin `cwd` (the worktree running `report`) — NOT the hook
// file's own location. A gate lane runs `report` in its worktree, where the
// active-intent cursor + the Slice's record dir live; the primary (where this
// hook file sits) does not carry an unmerged Slice's record, so anchoring the
// resolution here left the gate unable to see the very intent it must check.
// Falls back to CLAUDE_PROJECT_DIR/toolRoot when cwd is absent. Same
// invoking-checkout resolution as the scribe/status/attest — the pipeline reads
// the code being operated on, not the spawn dir. STATE/TRACE stay at the primary
// (gitignored runtime, one home); only the git-tracked record resolution moves.
const nearestCheckoutAt = (dir: string): string | undefined => {
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? undefined : nearestCheckoutAt(parent);
};

const checkoutRootFromCwd = (cwd: string | undefined): string | undefined =>
  cwd === undefined || cwd === "" ? undefined : nearestCheckoutAt(resolve(cwd));
const fallbackCheckout = resolve(env.CLAUDE_PROJECT_DIR ?? toolRoot);

const readStdin = (): Promise<string> =>
  new Promise((resolvePromise) => {
    let raw = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      raw += chunk;
    });
    stdin.on("end", () => resolvePromise(raw));
  });

const deny: (message: string) => never = (message) => {
  process.stderr.write(`Blocked (rin-gates autonomy): ${message}\n`);
  process.exit(2);
};

const intentsRoot = (checkoutRoot: string): string =>
  join(checkoutRoot, "aidlc", "spaces", space, "intents");

const activeRecordDir = (checkoutRoot: string): string | null => {
  const cursorPath = join(intentsRoot(checkoutRoot), "active-intent");
  if (!existsSync(cursorPath)) return null;
  const dirName = readFileSync(cursorPath, "utf8").trim();
  if (dirName === "") return null;
  const recordDir = join(intentsRoot(checkoutRoot), dirName);
  return existsSync(recordDir) ? recordDir : null;
};

const fieldFrom = (content: string, label: string): string | null => {
  const match = content.match(new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*(.+)`));
  return match ? match[1].trim() : null;
};

const scopeOf = (recordDir: string): string | null => {
  const statePath = join(recordDir, "aidlc-state.md");
  if (!existsSync(statePath)) return null;
  return fieldFrom(readFileSync(statePath, "utf8"), "Scope");
};

const gateFromCommand = (command: string, recordDir: string): string | null => {
  const stageMatch = command.match(/--stage\s+([A-Za-z0-9._-]+)/);
  if (stageMatch) return stageMatch[1];
  const statePath = join(recordDir, "aidlc-state.md");
  if (!existsSync(statePath)) return null;
  return fieldFrom(readFileSync(statePath, "utf8"), "Current Stage");
};

const verdictPath = (recordDir: string, gate: string): string | null => {
  const segments = reviewVerdictSegments(gate);
  return segments === null ? null : join(recordDir, ...segments);
};

const currentHeadSha = (checkoutRoot: string): string | null => {
  // H2: the env override is honoured ONLY under explicit test mode — never in
  // production, where a lane controlling the Bash env could otherwise spoof HEAD
  // to pass a replayed verdict. Production always reads real git.
  if (env.RIN_GATES_TEST_MODE === "1") {
    const injected = env.RIN_GATES_HEAD_SHA;
    if (injected !== undefined) return injected === "" ? null : injected;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: checkoutRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const sha = result.stdout?.trim();
  return result.status === 0 && sha ? sha : null;
};

const readVerdict = (path: string): ReviewVerdict | null => {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ReviewVerdict;
  } catch {
    return null;
  }
};

const gatedInvocationFrom = ({
  raw,
}: {
  readonly raw: string;
}): HookInput | null => {
  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    return null;
  }
  if (!isShellToolName(input.tool_name)) return null;
  const command = input.tool_input?.command ?? "";
  if (!(REPORT_COMPLETION.test(command) && COMPLETION_RESULT.test(command))) {
    return null;
  }
  return input;
};

const bypassHonoured = (): boolean => {
  if (env[BYPASS_ENV] !== "1") return false;
  process.stderr.write(
    `rin-gates autonomy: BYPASS honoured via ${BYPASS_ENV}=1 — approve NOT gated by a review verdict.\n`,
  );
  return true;
};

const fieldOf = (input: {
  readonly source: unknown;
  readonly key: string;
}): unknown =>
  typeof input.source === "object" &&
  input.source !== null &&
  input.key in input.source
    ? Object.getOwnPropertyDescriptor(input.source, input.key)?.value
    : undefined;

const LANDED_STRING_FIELDS = [
  "reviewedHeadSha",
  "mergeCommitSha",
  "diffDigest",
] as const;

const liveBindingOf = (input: {
  readonly raw: unknown;
}): Result<VerdictBinding, BindingReadFailure> => {
  const headSha = fieldOf({ source: input.raw, key: "headSha" });
  return typeof headSha === "string"
    ? succeed({ mode: "live", headSha })
    : failWith({
        kind: "binding-fields-incomplete",
        mode: "live",
        missing: ["headSha"],
      });
};

// Every missing or ill-typed field is named, not the first — a denial that names
// one field at a time turns a malformed binding into a guessing game.
const landedBindingOf = (input: {
  readonly raw: unknown;
}): Result<VerdictBinding, BindingReadFailure> => {
  const pullRequestNumber = fieldOf({
    source: input.raw,
    key: "pullRequestNumber",
  });
  const strings = LANDED_STRING_FIELDS.map((key) => ({
    key,
    value: fieldOf({ source: input.raw, key }),
  }));
  const missing = [
    ...(typeof pullRequestNumber === "number" ? [] : ["pullRequestNumber"]),
    ...strings
      .filter((field) => typeof field.value !== "string")
      .map((field) => field.key),
  ];
  const [reviewedHeadSha, mergeCommitSha, diffDigest] = strings.map(
    (field) => field.value,
  );
  if (
    typeof pullRequestNumber !== "number" ||
    typeof reviewedHeadSha !== "string" ||
    typeof mergeCommitSha !== "string" ||
    typeof diffDigest !== "string"
  ) {
    return failWith({
      kind: "binding-fields-incomplete",
      mode: "landed",
      missing,
    });
  }
  return succeed({
    mode: "landed",
    pullRequestNumber,
    reviewedHeadSha,
    mergeCommitSha,
    diffDigest,
  });
};

const bindingOf = (input: {
  readonly verdict: ReviewVerdict;
}): Result<VerdictBinding, BindingReadFailure> => {
  const raw = input.verdict.binding;
  if (raw === undefined || raw === null) {
    return typeof input.verdict.headSha === "string"
      ? succeed({ mode: "live", headSha: input.verdict.headSha })
      : failWith({ kind: "binding-absent-and-no-head-sha" });
  }
  const mode = fieldOf({ source: raw, key: "mode" });
  if (mode === "live") return liveBindingOf({ raw });
  if (mode === "landed") return landedBindingOf({ raw });
  return failWith({
    kind: "binding-mode-unknown",
    mode: typeof mode === "string" ? mode : "absent",
  });
};

const denialFor = (input: {
  readonly failure: BindingReadFailure;
  readonly gate: string;
}): string => {
  switch (input.failure.kind) {
    case "binding-absent-and-no-head-sha":
      return `review verdict for '${input.gate}' carries no binding and no headSha — nothing identifies the content the review covered.`;
    case "binding-mode-unknown":
      return `review verdict for '${input.gate}' declares an unknown binding mode '${input.failure.mode}' — the binding modes are 'live' and 'landed'.`;
    case "binding-fields-incomplete":
      return `review verdict for '${input.gate}' declares a '${input.failure.mode}' binding but the binding is incomplete — missing or ill-typed: ${input.failure.missing.join(", ")}.`;
  }
};

type GatePorts = {
  readonly resolveHeadSha: (input: { readonly cwd: string }) => string | null;
  readonly isAncestor: (input: {
    readonly ancestor: string;
    readonly descendant: string;
    readonly cwd: string;
  }) => boolean;
  readonly changedPathsBetween: (input: {
    readonly from: string;
    readonly to: string;
    readonly cwd: string;
  }) => Result<readonly string[], string>;
  readonly readMergeCommitPatch: (input: {
    readonly sha: string;
    readonly cwd: string;
  }) => Result<Buffer, string>;
};

// isAncestor maps exit 1 to a legitimate `false`, never to a failure — collapsing
// every non-zero exit into an error (as the review-worktree's runGitAt does) would
// turn a correct "not an ancestor" into a failure. Anything other than 0 or 1 is
// also false: a git error is not an ancestry proof, and reading one as proof would
// be a fail-open on the surface whose whole premise is that autonomy must be gated.
const gatePorts = (): GatePorts => ({
  resolveHeadSha: ({ cwd }) => currentHeadSha(cwd),
  isAncestor: ({ ancestor, descendant, cwd }) =>
    spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"],
    }).status === 0,
  changedPathsBetween: ({ from, to, cwd }) => {
    const spawned = spawnSync(
      "git",
      ["diff", "--name-only", `${from}..${to}`],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return spawned.status === 0
      ? succeed(
          (spawned.stdout ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line !== ""),
        )
      : failWith((spawned.stderr ?? "").trim());
  },
  readMergeCommitPatch: ({ sha, cwd }) => {
    const output = readSpawnedOutput({
      command: "git",
      args: ["diff", `${sha}^..${sha}`],
      cwd,
    });
    return output.outcome === "ok"
      ? succeed(output.value)
      : failWith(
          `git diff ${sha}^..${sha}: ${describeSpawnedOutputFailure(output.error)}`,
        );
  },
});

type MergeCommitPatchFailure = {
  readonly kind: "merge-commit-patch-unreadable";
  readonly detail: string;
};

const mergeCommitPatchDigestOf = (input: {
  readonly mergeCommitSha: string;
  readonly cwd: string;
  readonly readPatch: (input: {
    readonly sha: string;
    readonly cwd: string;
  }) => Result<Buffer, string>;
}): Result<string, MergeCommitPatchFailure> => {
  const patch = input.readPatch({ sha: input.mergeCommitSha, cwd: input.cwd });
  if (patch.outcome === "failed") {
    return failWith({
      kind: "merge-commit-patch-unreadable",
      detail: patch.error,
    });
  }
  return succeed(createHash("sha256").update(patch.value).digest("hex"));
};

const assertLandedBindingHolds = (input: {
  readonly binding: Extract<VerdictBinding, { mode: "landed" }>;
  readonly gate: string;
  readonly invokingCheckout: string;
  readonly ports: GatePorts;
}): void => {
  const { binding, gate, invokingCheckout, ports } = input;
  if (
    !ports.isAncestor({
      ancestor: binding.mergeCommitSha,
      descendant: "HEAD",
      cwd: invokingCheckout,
    })
  ) {
    deny(
      `review verdict for '${gate}' is bound to merge commit '${binding.mergeCommitSha}', which is not an ancestor of HEAD in this checkout — the invoking checkout must contain the merge commit; sync to origin/main and retry.`,
    );
  }
  const digest = mergeCommitPatchDigestOf({
    mergeCommitSha: binding.mergeCommitSha,
    cwd: invokingCheckout,
    readPatch: ports.readMergeCommitPatch,
  });
  if (digest.outcome === "failed") {
    deny(
      `review verdict for '${gate}': the merge-commit patch is unreadable for '${binding.mergeCommitSha}' — ${digest.error.detail}`,
    );
    return;
  }
  if (digest.value !== binding.diffDigest) {
    deny(
      `review verdict for '${gate}': the merge-commit patch digest recomputes to '${digest.value}' and does not match the recorded '${binding.diffDigest}' — the landed content is not what the review covered.`,
    );
  }
};

type RecordsOnlyDrift =
  | { readonly tolerated: true }
  | { readonly tolerated: false; readonly offendingPath: string };

const UNDERIVABLE_DIFF_SENTINEL = "<no changed paths derived>";

// An EMPTY changed-path set is NOT tolerated. Ancestry held and the shas differ,
// so an empty list means the diff could not be derived, not that nothing changed —
// a vacuous-truth allow there is the exact shape of an accidental fail-open.
const recordsOnlyDriftVerdictOf = (input: {
  readonly changedPaths: readonly string[];
  readonly allowedPrefix: string;
}): RecordsOnlyDrift => {
  if (input.changedPaths.length === 0) {
    return { tolerated: false, offendingPath: UNDERIVABLE_DIFF_SENTINEL };
  }
  const offending = input.changedPaths.find(
    (path) => !path.startsWith(input.allowedPrefix),
  );
  return offending === undefined
    ? { tolerated: true }
    : { tolerated: false, offendingPath: offending };
};

const assertLiveBindingHolds = (input: {
  readonly binding: Extract<VerdictBinding, { mode: "live" }>;
  readonly gate: string;
  readonly invokingCheckout: string;
  readonly recordDirName: string;
  readonly ports: GatePorts;
}): void => {
  const { binding, gate, invokingCheckout, recordDirName, ports } = input;
  const head = ports.resolveHeadSha({ cwd: invokingCheckout });
  if (head === null) return;
  if (binding.headSha === head) return;
  if (
    !ports.isAncestor({
      ancestor: binding.headSha,
      descendant: head,
      cwd: invokingCheckout,
    })
  ) {
    deny(
      `review verdict for '${gate}' headSha '${binding.headSha}' is stale: it is not an ancestor of HEAD ${head}, so the reviewed commit is on a divergent branch — re-review the current commit before approving.`,
    );
    return;
  }
  const changed = ports.changedPathsBetween({
    from: binding.headSha,
    to: head,
    cwd: invokingCheckout,
  });
  if (changed.outcome === "failed") {
    deny(
      `review verdict for '${gate}' headSha '${binding.headSha}' is stale (behind HEAD ${head}) and the gate could not derive the changed-path set between them (${changed.error}) — a diff that cannot be derived is never vacuously allowed.`,
    );
    return;
  }
  const drift = recordsOnlyDriftVerdictOf({
    changedPaths: changed.value,
    allowedPrefix: `aidlc/spaces/${space}/intents/${recordDirName}/`,
  });
  if (drift.tolerated) return;
  if (drift.offendingPath === UNDERIVABLE_DIFF_SENTINEL) {
    deny(
      `review verdict for '${gate}' headSha '${binding.headSha}' is stale (behind HEAD ${head}) and the gate could not derive the changed-path set between them (the diff is empty across differing commits) — a diff that cannot be derived is never vacuously allowed.`,
    );
    return;
  }
  deny(
    `review verdict for '${gate}' headSha '${binding.headSha}' is stale (behind HEAD ${head}) and the drift is not records-only: '${drift.offendingPath}' is a changed path outside the approving intent's record dir — re-review the current commit before approving.`,
  );
};

const assertReviewConverged = ({
  verdict,
  gate,
}: {
  readonly verdict: ReviewVerdict;
  readonly gate: string;
}): void => {
  const emittedBy = verdict.emittedBy ?? "absent";
  if (!ACCEPTED_VERDICT_EMITTERS.includes(emittedBy)) {
    deny(
      `review verdict for '${gate}' was not emitted by ${ACCEPTED_VERDICT_EMITTERS.join(" or ")} (emittedBy='${emittedBy}') — a hand-written verdict cannot rubber-stamp a gate.`,
    );
  }
  const lenses = Array.isArray(verdict.lenses) ? verdict.lenses : [];
  if (lenses.length === 0) {
    deny(
      `review verdict for '${gate}' names no lenses — a verdict with no decorrelated review is refused.`,
    );
  }
  // IF-2. The roster floor applies to EVERY accepted emitter, not only the
  // scribe. Fencing it behind `emittedBy === REVIEW_SCRIBE_EMITTER` meant the
  // CLI emitter — the one a lane drives by hand — was never held to a floor at
  // all, which is the hole this record exists to close. Every other check in
  // this function is already emitter-agnostic; this one now sits beside them.
  const rosterRefusal = rosterFloorRefusal({
    gate,
    resolution: reviewRosterFor(gate),
    lenses,
  });
  if (rosterRefusal !== null) deny(rosterRefusal);
  if (verdict.verdict !== "READY") {
    deny(
      `review verdict for '${gate}' is '${verdict.verdict ?? "absent"}', not READY — the review has not converged.`,
    );
  }
  // The findings gate, re-checked at the authorising boundary (task 019f6d3e).
  // Both producers refuse to emit a READY over an undisposed finding, but the
  // producers are not what authorises the approve — this hook is. Trusting them
  // alone would mean the guarantee holds only for verdicts written by a
  // current-version tool: a verdict emitted by an older scribe (a worktree cut
  // before that change still runs its own copy) carries READY beside live
  // findings, and headSha freshness cannot detect a stale TOOL, only a stale
  // commit. So the consumer reads the field the producer writes.
  const blockingFindings = Array.isArray(verdict.blockingFindings)
    ? verdict.blockingFindings
    : [];
  if (blockingFindings.length > 0) {
    deny(
      `review verdict for '${gate}' is READY but carries ${blockingFindings.length} undisposed finding(s) — a READY cannot outrank the review's own findings (decorrelated-review.md Step 5). Resolve them and re-review:\n${blockingFindings.map((finding) => `  - ${finding}`).join("\n")}`,
    );
  }
};

const assertVerdictAuthorises = ({
  verdict,
  gate,
  invokingCheckout,
  recordDirName,
  ports,
}: {
  readonly verdict: ReviewVerdict;
  readonly gate: string;
  readonly invokingCheckout: string;
  readonly recordDirName: string;
  readonly ports: GatePorts;
}): void => {
  assertReviewConverged({ verdict, gate });

  const binding = bindingOf({ verdict });
  if (binding.outcome === "failed") {
    deny(denialFor({ failure: binding.error, gate }));
    return;
  }
  switch (binding.value.mode) {
    case "live":
      assertLiveBindingHolds({
        binding: binding.value,
        gate,
        invokingCheckout,
        recordDirName,
        ports,
      });
      return;
    case "landed":
      assertLandedBindingHolds({
        binding: binding.value,
        gate,
        invokingCheckout,
        ports,
      });
      return;
  }
};

type ScopeCoverage =
  | { readonly kind: "covered" }
  | { readonly kind: "not-covered" }
  | { readonly kind: "indeterminate"; readonly reason: string };

const gridPathFor = (checkoutRoot: string): string =>
  join(checkoutRoot, ...SCOPE_GRID_SEGMENTS);

const parsedGridFrom = (path: string): unknown => {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
};

const rinGatesFloorCoverage = (input: {
  readonly checkoutRoot: string;
}): ScopeCoverage => {
  const parsed = parsedGridFrom(gridPathFor(input.checkoutRoot));
  if (parsed === undefined || parsed === null) return { kind: "covered" };
  const row = fieldOf({ source: parsed, key: RIN_GATES_SCOPE });
  if (row === undefined) {
    return {
      kind: "indeterminate",
      reason: `the grid carries no '${RIN_GATES_SCOPE}' row`,
    };
  }
  const stages = fieldOf({ source: row, key: "stages" });
  const cell =
    typeof stages === "object" && stages !== null
      ? fieldOf({ source: stages, key: GATE_5_STAGE })
      : undefined;
  if (cell === "EXECUTE") return { kind: "covered" };
  return {
    kind: "indeterminate",
    reason: `the grid row for '${RIN_GATES_SCOPE}' does not hold '${GATE_5_STAGE}: EXECUTE', and the pipeline scope is never un-gated by its own grid row`,
  };
};

const scopeCoverageOf = (input: {
  readonly scope: string;
  readonly grid: unknown;
}): ScopeCoverage => {
  if (input.grid === undefined || input.grid === null) {
    return input.scope.startsWith("rin-")
      ? {
          kind: "indeterminate",
          reason: "the scope grid is missing or unreadable",
        }
      : { kind: "not-covered" };
  }
  const row = fieldOf({ source: input.grid, key: input.scope });
  if (row === undefined) {
    return input.scope.startsWith("rin-")
      ? {
          kind: "indeterminate",
          reason: `the grid carries no '${input.scope}' row`,
        }
      : { kind: "not-covered" };
  }
  const stages = fieldOf({ source: row, key: "stages" });
  if (typeof stages !== "object" || stages === null) {
    return {
      kind: "indeterminate",
      reason: `the grid row for '${input.scope}' is malformed — its 'stages' is not an object`,
    };
  }
  const cell = fieldOf({ source: stages, key: GATE_5_STAGE });
  if (cell === "EXECUTE") return { kind: "covered" };
  if (cell === "SKIP") return { kind: "not-covered" };
  return {
    kind: "indeterminate",
    reason:
      cell === undefined
        ? `the grid row for '${input.scope}' holds no '${GATE_5_STAGE}' key`
        : `the grid row for '${input.scope}' holds an uninterpretable '${GATE_5_STAGE}' value`,
  };
};

const coverageOf = (input: {
  readonly scope: string;
  readonly checkoutRoot: string;
}): ScopeCoverage => {
  if (input.scope === RIN_GATES_SCOPE) return rinGatesFloorCoverage(input);
  return scopeCoverageOf({
    scope: input.scope,
    grid: parsedGridFrom(gridPathFor(input.checkoutRoot)),
  });
};

// Returns the record dir when this approve is covered by the backstop and must be
// gated; null when the scope is positively NOT covered, so it is not this hook's
// concern. H1 fail-closed: an INDETERMINATE scope — no resolvable active intent,
// a state file with no Scope, or a grid that cannot answer for the scope — must
// NOT fail open on the very surface whose premise is "autonomy must be gated", so
// it denies rather than passing.
const gatedRecordDir = ({
  invokingCheckout,
}: {
  readonly invokingCheckout: string;
}): string | null => {
  const recordDir = activeRecordDir(invokingCheckout);
  if (recordDir === null) {
    deny(
      `cannot resolve the active intent's record dir for this report --result approved (recordDir=absent). ` +
        `Refusing fail-open on the autonomy-gated surface — resolve the active-intent cursor, or set ${BYPASS_ENV}=1 to override.`,
    );
    return null;
  }
  const scope = scopeOf(recordDir);
  if (scope === null) {
    deny(
      `cannot resolve the active intent's scope for this report --result approved (recordDir=present, scope=absent). ` +
        `Refusing fail-open on the autonomy-gated surface — resolve the aidlc-state.md Scope, or set ${BYPASS_ENV}=1 to override.`,
    );
    return null;
  }
  const coverage = coverageOf({ scope, checkoutRoot: invokingCheckout });
  if (coverage.kind === "not-covered") return null;
  if (coverage.kind === "indeterminate") {
    deny(
      `cannot determine whether scope '${scope}' is covered by the autonomy backstop: ${coverage.reason}. ` +
        `Refusing fail-open on the autonomy-gated surface — regenerate the scope grid, or set ${BYPASS_ENV}=1 to override.`,
    );
    return null;
  }
  return recordDir;
};

const main = async (): Promise<void> => {
  if (stdin.isTTY) process.exit(0);
  const raw = await readStdin();
  if (raw.trim() === "") process.exit(0);

  const input = gatedInvocationFrom({ raw });
  if (input === null) process.exit(0);
  const command = input.tool_input?.command ?? "";

  if (bypassHonoured()) process.exit(0);

  const invokingCheckout = checkoutRootFromCwd(input.cwd) ?? fallbackCheckout;
  const recordDir = gatedRecordDir({ invokingCheckout });
  if (recordDir === null) process.exit(0);

  const gate = gateFromCommand(command, recordDir);
  if (gate === null) {
    deny(
      "cannot resolve the gate from the report command or Current Stage — refusing an unverifiable rin-gates approve.",
    );
  }

  const path = verdictPath(recordDir, gate);
  if (path === null)
    deny(
      `gate '${gate}' has no known phase mapping — cannot locate its review verdict.`,
    );

  const verdict = readVerdict(path);
  if (verdict === null) {
    deny(
      `no decorrelated-review verdict at ${path} — a rin-gates gate approve requires a review emitted by \`pnpm rin-gates:review-verdict\` (never a hand-written file).`,
    );
  }
  assertVerdictAuthorises({
    verdict,
    gate,
    invokingCheckout,
    recordDirName: basename(recordDir),
    ports: gatePorts(),
  });

  process.exit(0);
};

if (import.meta.main) {
  main().catch(() => process.exit(0));
}

export {
  type BindingReadFailure,
  bindingOf,
  phaseOfGate,
  type RecordsOnlyDrift,
  type ReviewVerdict,
  recordsOnlyDriftVerdictOf,
  rosterFloorRefusal,
  scopeCoverageOf,
  type VerdictBinding,
  verdictPath,
};
