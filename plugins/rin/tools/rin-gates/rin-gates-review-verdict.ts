import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  configR7OptIn,
  requiresExceptionWhyChains,
} from "../rin-harness-config.ts";
import {
  type GatePhase,
  type GateSlug,
  gateDirSegments,
} from "./rin-gate-namespace.ts";
import { blockingFindingsWithPolicy } from "./rin-gates-finding-disposition.ts";

const SHORT_SHA_LENGTH = 8;

const HERE = dirname(fileURLToPath(import.meta.url));
const checkoutRootFrom = (dir: string, fallback: string): string => {
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? fallback : checkoutRootFrom(parent, fallback);
};

const checkoutRootFromHere = (start: string): string =>
  checkoutRootFrom(resolve(start), resolve(start));
const INVOKING_CHECKOUT = checkoutRootFromHere(HERE);

const fail: (message: string) => never = (message) => {
  console.error(`rin-gates-review-verdict: ${message}`);
  process.exit(1);
};

const argValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  return index === -1 || index + 1 >= process.argv.length
    ? null
    : (process.argv[index + 1] ?? null);
};

const headShaOf = (checkout: string): string | null => {
  if (process.env["RIN_GATES_TEST_MODE"] === "1") {
    const injected = process.env["RIN_GATES_HEAD_SHA"];
    if (injected !== undefined) return injected === "" ? null : injected;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: checkout,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const sha = result.stdout?.trim();
  return result.status === 0 && sha ? sha : null;
};

const diffDigestOf = (checkout: string, base: string): string => {
  if (process.env["RIN_GATES_TEST_MODE"] === "1") {
    const injected = process.env["RIN_GATES_DIFF_DIGEST"];
    if (injected !== undefined) return injected;
  }
  const output = readSpawnedOutput({
    command: "git",
    args: ["diff", `${base}...HEAD`],
    cwd: checkout,
  });
  return output.outcome === "ok"
    ? createHash("sha256").update(output.value).digest("hex")
    : `unreadable:${describeSpawnedOutputFailure(output.error)}`;
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

const readSpawnedOutput = (input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly environment?: NodeJS.ProcessEnv;
}): Result<Buffer, SpawnedOutputFailure> => {
  const scratchDir = mkdtempSync(join(tmpdir(), "rin-gates-spawn-output-"));
  const descriptor = openSync(join(scratchDir, "stdout.bin"), "w+");
  try {
    const spawned = spawnSync(input.command, [...input.args], {
      cwd: input.cwd,
      stdio: ["ignore", descriptor, "ignore"],
      ...(input.environment === undefined ? {} : { env: input.environment }),
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

type BindingRequest =
  | { readonly mode: "live" }
  | {
      readonly mode: "landed";
      readonly pullRequestNumber: number;
      readonly reviewedHeadSha: string;
      readonly mergeCommitSha: string;
      readonly reviewedAt: string | null;
    };

type PullRequestLanding = {
  readonly state: string;
  readonly headRefOid: string;
  readonly mergeCommitOid: string | null;
};

type LandedEvidencePorts = {
  readonly readPullRequestLanding: (input: {
    readonly pullRequestNumber: number;
  }) => Result<PullRequestLanding, string>;
  readonly commitExists: (input: {
    readonly sha: string;
    readonly cwd: string;
  }) => boolean;
  readonly readMergeCommitPatch: (input: {
    readonly sha: string;
    readonly cwd: string;
  }) => Result<Buffer, string>;
};

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
  const patch = input.readPatch({
    sha: input.mergeCommitSha,
    cwd: input.cwd,
  });
  if (patch.outcome === "failed") {
    return failWith({
      kind: "merge-commit-patch-unreadable",
      detail: patch.error,
    });
  }
  return succeed(createHash("sha256").update(patch.value).digest("hex"));
};

type LandedEvidenceFailure =
  | { readonly kind: "pull-request-unreadable"; readonly detail: string }
  | { readonly kind: "pull-request-not-merged"; readonly state: string }
  | {
      readonly kind: "reviewed-head-mismatch";
      readonly expected: string;
      readonly observed: string;
    }
  | {
      readonly kind: "merge-commit-mismatch";
      readonly expected: string;
      readonly observed: string;
    }
  | {
      readonly kind: "merge-commit-unresolvable";
      readonly mergeCommitSha: string;
    }
  | { readonly kind: "merge-commit-patch-unreadable"; readonly detail: string };

type LandedEvidence = {
  readonly pullRequestNumber: number;
  readonly reviewedHeadSha: string;
  readonly mergeCommitSha: string;
  readonly diffDigest: string;
};

const landedEvidenceOf = (input: {
  readonly request: Extract<BindingRequest, { mode: "landed" }>;
  readonly workspaceRoot: string;
  readonly ports: LandedEvidencePorts;
}): Result<LandedEvidence, LandedEvidenceFailure> => {
  const { request, workspaceRoot, ports } = input;
  const landing = ports.readPullRequestLanding({
    pullRequestNumber: request.pullRequestNumber,
  });
  if (landing.outcome === "failed") {
    return failWith({ kind: "pull-request-unreadable", detail: landing.error });
  }
  if (landing.value.state !== "MERGED") {
    return failWith({
      kind: "pull-request-not-merged",
      state: landing.value.state,
    });
  }
  if (landing.value.headRefOid !== request.reviewedHeadSha) {
    return failWith({
      kind: "reviewed-head-mismatch",
      expected: request.reviewedHeadSha,
      observed: landing.value.headRefOid,
    });
  }
  if (landing.value.mergeCommitOid !== request.mergeCommitSha) {
    return failWith({
      kind: "merge-commit-mismatch",
      expected: request.mergeCommitSha,
      observed: landing.value.mergeCommitOid ?? "null",
    });
  }
  if (
    !ports.commitExists({ sha: request.mergeCommitSha, cwd: workspaceRoot })
  ) {
    return failWith({
      kind: "merge-commit-unresolvable",
      mergeCommitSha: request.mergeCommitSha,
    });
  }
  const digest = mergeCommitPatchDigestOf({
    mergeCommitSha: request.mergeCommitSha,
    cwd: workspaceRoot,
    readPatch: ports.readMergeCommitPatch,
  });
  if (digest.outcome === "failed") {
    return failWith({
      kind: "merge-commit-patch-unreadable",
      detail: digest.error.detail,
    });
  }
  return succeed({
    pullRequestNumber: request.pullRequestNumber,
    reviewedHeadSha: request.reviewedHeadSha,
    mergeCommitSha: request.mergeCommitSha,
    diffDigest: digest.value,
  });
};

const landedEvidenceRefusal = (failure: LandedEvidenceFailure): string => {
  switch (failure.kind) {
    case "pull-request-unreadable":
      return `cannot read the pull request through gh — a landed verdict needs the PR's own landing facts: ${failure.detail}`;
    case "pull-request-not-merged":
      return `pull request state is '${failure.state}', not MERGED — a landed verdict records a review of merged content; review the live head instead`;
    case "reviewed-head-mismatch":
      return `--reviewed-head-sha '${failure.expected}' is not the pull request's head (gh reports '${failure.observed}') — the review did not cover the head that landed`;
    case "merge-commit-mismatch":
      return `--merge-commit-sha '${failure.expected}' is not the pull request's merge commit (gh reports '${failure.observed}')`;
    case "merge-commit-unresolvable":
      return `merge commit '${failure.mergeCommitSha}' does not resolve in this checkout — fetch or sync to origin/main before emitting a landed verdict`;
    case "merge-commit-patch-unreadable":
      return `merge-commit patch is unreadable, so no digest can be recorded: ${failure.detail}`;
  }
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

const readPullRequestLandingAt = (input: {
  readonly pullRequestNumber: number;
  readonly workspaceRoot: string;
}): Result<PullRequestLanding, string> => {
  const spawned = spawnSync(
    "gh",
    [
      "pr",
      "view",
      String(input.pullRequestNumber),
      "--json",
      "state,headRefOid,mergeCommit",
    ],
    { cwd: input.workspaceRoot, encoding: "utf8" },
  );
  if (spawned.status !== 0) {
    return failWith((spawned.stderr ?? spawned.stdout ?? "").trim());
  }
  const parsed: unknown = (() => {
    try {
      return JSON.parse(spawned.stdout ?? "");
    } catch {
      return null;
    }
  })();
  if (parsed === null) {
    return failWith("gh pr view returned no parseable JSON object");
  }
  const state = fieldOf({ source: parsed, key: "state" });
  const headRefOid = fieldOf({ source: parsed, key: "headRefOid" });
  if (typeof state !== "string" || typeof headRefOid !== "string") {
    return failWith("gh pr view returned no state/headRefOid");
  }
  const oid = fieldOf({
    source: fieldOf({ source: parsed, key: "mergeCommit" }),
    key: "oid",
  });
  return succeed({
    state,
    headRefOid,
    mergeCommitOid: typeof oid === "string" ? oid : null,
  });
};

const landedEvidencePorts = (): LandedEvidencePorts => ({
  readPullRequestLanding: ({ pullRequestNumber }) =>
    readPullRequestLandingAt({
      pullRequestNumber,
      workspaceRoot:
        process.env["RIN_GATES_WORKSPACE_ROOT"] ?? INVOKING_CHECKOUT,
    }),
  commitExists: ({ sha, cwd }) =>
    spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"],
    }).status === 0,
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

type VerdictInputs = {
  readonly recordDir: string;
  readonly gate: string;
  readonly taskId: string;
  readonly verdict: "READY" | "NOT-READY";
  readonly lenses: readonly string[];
  readonly findings: readonly string[];
  readonly blockingFindings: readonly string[];
  readonly base: string;
  readonly gateSegments: readonly [GatePhase, GateSlug];
  readonly binding: BindingRequest;
};

type LiveVerdictPayload = {
  readonly gate: string;
  readonly taskId: string;
  readonly headSha: string;
  readonly diffDigest: string;
  readonly base: string;
  readonly verdict: "READY" | "NOT-READY";
  readonly lenses: readonly string[];
  readonly findings: readonly string[];
  readonly blockingFindings: readonly string[];
  readonly reviewedAt: string;
  readonly emittedBy: "rin-gates-review-verdict";
  readonly binding: Extract<VerdictBinding, { mode: "live" }>;
};

type LandedVerdictPayload = {
  readonly gate: string;
  readonly taskId: string;
  readonly verdict: "READY" | "NOT-READY";
  readonly lenses: readonly string[];
  readonly findings: readonly string[];
  readonly blockingFindings: readonly string[];
  readonly reviewedAt: string;
  readonly emittedBy: "rin-gates-review-verdict";
  readonly binding: Extract<VerdictBinding, { mode: "landed" }>;
};

const liveVerdictPayloadOf = (input: {
  readonly inputs: VerdictInputs;
  readonly headSha: string;
  readonly diffDigest: string;
  readonly reviewedAt: string;
}): LiveVerdictPayload => ({
  gate: input.inputs.gate,
  taskId: input.inputs.taskId,
  headSha: input.headSha,
  diffDigest: input.diffDigest,
  base: input.inputs.base,
  verdict: input.inputs.verdict,
  lenses: input.inputs.lenses,
  findings: input.inputs.findings,
  blockingFindings: input.inputs.blockingFindings,
  reviewedAt: input.reviewedAt,
  emittedBy: "rin-gates-review-verdict",
  binding: { mode: "live", headSha: input.headSha },
});

const landedVerdictPayloadOf = (input: {
  readonly inputs: VerdictInputs;
  readonly evidence: LandedEvidence;
  readonly reviewedAt: string;
}): LandedVerdictPayload => ({
  gate: input.inputs.gate,
  taskId: input.inputs.taskId,
  verdict: input.inputs.verdict,
  lenses: input.inputs.lenses,
  findings: input.inputs.findings,
  blockingFindings: input.inputs.blockingFindings,
  reviewedAt: input.reviewedAt,
  emittedBy: "rin-gates-review-verdict",
  binding: {
    mode: "landed",
    pullRequestNumber: input.evidence.pullRequestNumber,
    reviewedHeadSha: input.evidence.reviewedHeadSha,
    mergeCommitSha: input.evidence.mergeCommitSha,
    diffDigest: input.evidence.diffDigest,
  },
});

type FindingScan = {
  readonly rows: readonly string[];
  readonly current: string;
  readonly depth: number;
};

const PARENTHESIS_DEPTH_CHANGE: Readonly<Record<string, number>> = {
  "(": 1,
  ")": -1,
};

const scanFindingCharacter = (
  scan: FindingScan,
  character: string,
): FindingScan =>
  character === "\n" || (character === ";" && scan.depth === 0)
    ? { rows: [...scan.rows, scan.current], current: "", depth: 0 }
    : {
        rows: scan.rows,
        current: scan.current + character,
        depth: Math.max(
          0,
          scan.depth + (PARENTHESIS_DEPTH_CHANGE[character] ?? 0),
        ),
      };

const parseFindings = (raw: string | null): readonly string[] => {
  const scan = [...(raw ?? "")].reduce<FindingScan>(scanFindingCharacter, {
    rows: [],
    current: "",
    depth: 0,
  });
  return [...scan.rows, scan.current]
    .map((finding) => finding.trim())
    .filter((finding) => finding !== "");
};

const LANDED_FLAGS = [
  "--pr",
  "--reviewed-head-sha",
  "--merge-commit-sha",
] as const;

const parseBindingRequest = (): BindingRequest => {
  const supplied = LANDED_FLAGS.filter((flag) => argValue(flag) !== null);
  const reviewedAt = argValue("--reviewed-at");
  if (supplied.length === 0) {
    if (reviewedAt !== null) {
      fail(
        "--reviewed-at is landed-path-only: on the live path the timestamp is stamped at emit time, and accepting a caller-supplied one would let a stale review present itself as fresh",
      );
    }
    return { mode: "live" };
  }
  if (supplied.length !== LANDED_FLAGS.length) {
    const missing = LANDED_FLAGS.filter((flag) => argValue(flag) === null);
    fail(
      `the landed flags are all-or-nothing: present [${supplied.join(", ")}], missing [${missing.join(", ")}] — refusing to fall back to a live verdict a caller believes is landed`,
    );
  }
  const prRaw = argValue("--pr") ?? "";
  const pullRequestNumber = Number(prRaw);
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
    fail(`--pr must be a positive integer (observed '${prRaw}')`);
  }
  return {
    mode: "landed",
    pullRequestNumber,
    reviewedHeadSha: argValue("--reviewed-head-sha") ?? "",
    mergeCommitSha: argValue("--merge-commit-sha") ?? "",
    reviewedAt,
  };
};

const parseVerdictInputs = ({
  workspaceRoot,
}: {
  readonly workspaceRoot: string;
}): VerdictInputs => {
  if (process.env["RIN_GATES_VERDICT_EMITTER"] !== "1") {
    fail(
      "must run with RIN_GATES_VERDICT_EMITTER=1 (the token the verdict guard requires) — the verdict is tool-writable-only.",
    );
  }
  const recordDir = argValue("--record-dir");
  const gateArg = argValue("--gate");
  const taskId = argValue("--task-id");
  const verdict = argValue("--verdict");
  const lensesRaw = argValue("--lenses");
  const base = argValue("--base") ?? "origin/main";
  if (recordDir === null) fail("--record-dir is required");
  if (gateArg === null) fail("--gate is required");
  if (taskId === null) fail("--task-id is required");
  if (verdict !== "READY" && verdict !== "NOT-READY")
    fail("--verdict must be READY or NOT-READY");
  const lenses = (lensesRaw ?? "")
    .split(",")
    .map((lens) => lens.trim())
    .filter((lens) => lens !== "");
  if (lenses.length === 0)
    fail(
      "--lenses must name at least one decorrelated lens that ran — a verdict with no lenses is not a review",
    );
  const gateSegments = gateDirSegments(gateArg);
  if (gateSegments === null)
    fail(`gate '${gateArg}' has no known phase mapping`);
  const findings = parseFindings(argValue("--findings"));
  const optIn = configR7OptIn({ projectDir: workspaceRoot });
  if (optIn.kind === "invalid") {
    fail(`harness.config.json is invalid: ${optIn.reason}`);
  }
  const blocking = blockingFindingsWithPolicy({
    findings,
    exceptionWhyChainsEnabled: requiresExceptionWhyChains({ optIn }),
  });
  if (verdict === "READY" && blocking.length > 0) {
    fail(
      `refusing a READY verdict over ${blocking.length} undisposed finding(s) — Step 5 (decorrelated-review.md) requires every VIOLATION resolved before READY. Fix them and re-review, or dispose of each WITH ITS EVIDENCE — 'fixed@<sha>', 'push-back(<ground citing CD-N / principle / file:line>)', 'defer(ack:<ref>)', or 'withdrawn(<reason>)'. A bare disposition word is not a disposition:\n${blocking.map((finding) => `  - ${finding}`).join("\n")}`,
    );
  }
  return {
    recordDir,
    gate: gateArg,
    taskId,
    verdict,
    lenses,
    findings,
    blockingFindings: blocking,
    base,
    gateSegments,
    binding: parseBindingRequest(),
  };
};

type ComposedVerdict = {
  readonly payload: LiveVerdictPayload | LandedVerdictPayload;
  readonly summary: string;
};

const composedVerdictOf = (input: {
  readonly inputs: VerdictInputs;
  readonly workspaceRoot: string;
}): ComposedVerdict => {
  const { inputs, workspaceRoot } = input;
  switch (inputs.binding.mode) {
    case "live": {
      const headSha = headShaOf(workspaceRoot);
      if (headSha === null) return fail("cannot resolve HEAD sha");
      const diffDigest = diffDigestOf(workspaceRoot, inputs.base);
      return {
        payload: liveVerdictPayloadOf({
          inputs,
          headSha,
          diffDigest,
          reviewedAt: new Date().toISOString(),
        }),
        summary: `headSha ${headSha.slice(0, SHORT_SHA_LENGTH)}`,
      };
    }
    case "landed": {
      const evidence = landedEvidenceOf({
        request: inputs.binding,
        workspaceRoot,
        ports: landedEvidencePorts(),
      });
      if (evidence.outcome === "failed") {
        return fail(landedEvidenceRefusal(evidence.error));
      }
      return {
        payload: landedVerdictPayloadOf({
          inputs,
          evidence: evidence.value,
          reviewedAt: inputs.binding.reviewedAt ?? new Date().toISOString(),
        }),
        summary: `landed PR #${inputs.binding.pullRequestNumber}, merge commit ${evidence.value.mergeCommitSha.slice(0, SHORT_SHA_LENGTH)}`,
      };
    }
  }
};

const run = (): void => {
  const workspaceRoot =
    process.env["RIN_GATES_WORKSPACE_ROOT"] ?? INVOKING_CHECKOUT;
  const inputs = parseVerdictInputs({ workspaceRoot });

  const space = process.env["RIN_GATES_SPACE"] ?? "default";
  const recordDirPath = join(
    workspaceRoot,
    "aidlc",
    "spaces",
    space,
    "intents",
    inputs.recordDir,
  );
  if (!existsSync(recordDirPath))
    fail(`record dir absent: ${inputs.recordDir}`);

  const composed = composedVerdictOf({ inputs, workspaceRoot });

  const gateDir = join(recordDirPath, ...inputs.gateSegments);
  mkdirSync(gateDir, { recursive: true });
  writeFileSync(
    join(gateDir, "review-verdict.json"),
    `${JSON.stringify(composed.payload, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `VERDICT ${inputs.verdict}  ${inputs.gate} -> ${inputs.recordDir} (${composed.summary}, ${inputs.lenses.length} lens(es))`,
  );
};

if (import.meta.main) run();

export {
  type LandedEvidence,
  type LandedEvidenceFailure,
  type LandedEvidencePorts,
  type LandedVerdictPayload,
  type LiveVerdictPayload,
  landedEvidenceOf,
  landedVerdictPayloadOf,
  liveVerdictPayloadOf,
  mergeCommitPatchDigestOf,
  type PullRequestLanding,
  type VerdictInputs,
};
