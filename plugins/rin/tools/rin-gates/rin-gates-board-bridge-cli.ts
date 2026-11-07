import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  type NonBlankExecutable,
  type ResolvedReviewCommand,
  readConfig,
} from "../rin-harness-config.ts";
import { reviewVerdictSegments } from "./rin-gate-namespace.ts";
import {
  type BridgeOutcome,
  type BridgePorts,
  type BridgeResult,
  bridgeBoardVerdict,
  type PullRequestState,
  type ReviewPost,
  refusalMessage,
  SHORT_SHA_LENGTH,
  type StandingReview,
} from "./rin-gates-board-bridge.ts";
import {
  createNodeWorkflowUtilityExecutor,
  resolveConsumerWorkflowContext,
} from "./rin-gates-workflow-selection.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const checkoutRootFrom = (dir: string, fallback: string): string => {
  if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "aidlc")))
    return dir;
  const parent = dirname(dir);
  return parent === dir ? fallback : checkoutRootFrom(parent, fallback);
};

const INVOKING_CHECKOUT = checkoutRootFrom(resolve(HERE), resolve(HERE));

// A usage refusal is plain data, not an authored error class (CD-11). It is
// thrown rather than exiting inline so the compiler narrows past every guard
// below without a `return` in a void-returning entry point; the entry point
// turns it back into the exit code.
type UsageRefusal = {
  readonly kind: "usage-refusal";
  readonly message: string;
};

const isUsageRefusal = (thrown: unknown): thrown is UsageRefusal =>
  typeof thrown === "object" &&
  thrown !== null &&
  "kind" in thrown &&
  thrown.kind === "usage-refusal";

const fail: (message: string) => never = (message) => {
  const refusal: UsageRefusal = { kind: "usage-refusal", message };
  throw refusal;
};

const argValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1] ?? null;
};

const readVerdictFile = (input: { readonly path: string }): string | null => {
  try {
    return readFileSync(input.path, "utf8");
  } catch {
    return null;
  }
};

const ghJson = (input: {
  readonly args: readonly string[];
}): unknown | null => {
  const result = spawnSync("gh", [...input.args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout ?? "");
  } catch {
    return null;
  }
};

const PullRequestStateSchema = z.object({
  state: z.string(),
  headRefOid: z.string(),
});

const ReviewsPayloadSchema = z.object({
  reviews: z.array(
    z.object({
      state: z.string(),
      submittedAt: z.string(),
      commit: z.object({ oid: z.string() }).nullish(),
    }),
  ),
});

const readPullRequest = (input: {
  readonly pullRequestNumber: number;
}): PullRequestState | null => {
  const decoded = PullRequestStateSchema.safeParse(
    ghJson({
      args: [
        "pr",
        "view",
        String(input.pullRequestNumber),
        "--json",
        "state,headRefOid",
      ],
    }),
  );
  return decoded.success ? decoded.data : null;
};

const readReviews = (input: {
  readonly pullRequestNumber: number;
}): readonly StandingReview[] => {
  const decoded = ReviewsPayloadSchema.safeParse(
    ghJson({
      args: [
        "pr",
        "view",
        String(input.pullRequestNumber),
        "--json",
        "reviews",
      ],
    }),
  );
  if (!decoded.success) return [];
  return decoded.data.reviews.map((review) => ({
    state: review.state,
    commitSha: review.commit?.oid ?? null,
    submittedAt: review.submittedAt,
  }));
};

type ReviewCommandExecution =
  | { readonly kind: "completed"; readonly processStatus: number }
  | { readonly kind: "launch-failed" }
  | { readonly kind: "interrupted"; readonly terminationSignal: string };

type ReviewCommandExecutor = {
  readonly execute: (reviewCommand: {
    readonly executable: NonBlankExecutable;
    readonly commandArguments: readonly string[];
  }) => ReviewCommandExecution;
};

type CreateNodeReviewCommandExecutor = () => ReviewCommandExecutor;

const createNodeReviewCommandExecutor: CreateNodeReviewCommandExecutor =
  () => ({
    execute: ({ executable, commandArguments }) => {
      try {
        const result = spawnSync(executable, [...commandArguments], {
          encoding: "utf8",
          stdio: ["ignore", "inherit", "inherit"],
        });
        if (result.error) return { kind: "launch-failed" };
        if (result.signal)
          return { kind: "interrupted", terminationSignal: result.signal };
        if (result.status === null) return { kind: "launch-failed" };
        return { kind: "completed", processStatus: result.status };
      } catch {
        return { kind: "launch-failed" };
      }
    },
  });

const createReviewPostPort =
  ({
    reviewCommand,
    executor,
  }: {
    readonly reviewCommand: ResolvedReviewCommand;
    readonly executor: ReviewCommandExecutor;
  }): ReviewPost =>
  (input) => {
    if (reviewCommand.kind === "unconfigured") {
      return {
        outcome: "failed",
        reviewPostFailure: { kind: "review-post-unconfigured" },
      };
    }
    const execution = executor.execute({
      executable: reviewCommand.binding.executable,
      commandArguments: [
        ...reviewCommand.binding.commandArguments,
        "--pr",
        String(input.pullRequestNumber),
        "--event",
        input.event,
        "--commit-sha",
        input.commitSha,
        "--body",
        input.body,
      ],
    });
    switch (execution.kind) {
      case "launch-failed":
        return {
          outcome: "failed",
          reviewPostFailure: { kind: "review-post-unavailable" },
        };
      case "interrupted":
        return {
          outcome: "failed",
          reviewPostFailure: {
            kind: "review-post-interrupted",
            terminationSignal: execution.terminationSignal,
          },
        };
      case "completed":
        return execution.processStatus === 0
          ? { outcome: "posted" }
          : {
              outcome: "failed",
              reviewPostFailure: {
                kind: "review-post-refused",
                processStatus: execution.processStatus,
              },
            };
    }
  };

// The verdict's home is derived from the OWNED gate namespace rather than a
// second private copy of the phase mapping — the disagreement that made a
// writer and a reader resolve different paths is what `rin-gate-namespace.ts`
// exists to make unrepresentable.
const verdictPathFor = (input: {
  readonly workspaceRoot: string;
  readonly space: string;
  readonly recordDir: string;
  readonly gate: string;
}): string | null => {
  const segments = reviewVerdictSegments(input.gate);
  return segments === null
    ? null
    : join(
        input.workspaceRoot,
        "aidlc",
        "spaces",
        input.space,
        "intents",
        input.recordDir,
        ...segments,
      );
};

const reportBridgeResult = ({
  result,
  pullRequestNumber,
}: {
  readonly result: BridgeResult;
  readonly pullRequestNumber: number;
}): void => {
  if (result.outcome === "refused") {
    console.error(`rin-gates-board-bridge: ${refusalMessage(result.refusal)}`);
    process.exit(1);
  }

  const value: BridgeOutcome = result.value;
  console.log(
    value.disposition === "posted"
      ? `POSTED ${value.event} on PR #${pullRequestNumber} bound to ${value.commitSha.slice(0, SHORT_SHA_LENGTH)}`
      : `INHERITED ${value.standingState} already standing on PR #${pullRequestNumber} at ${value.commitSha.slice(0, SHORT_SHA_LENGTH)} — nothing posted`,
  );
};

const reviewCommandFor = ({
  consumerRoot,
}: {
  readonly consumerRoot: string;
}): ResolvedReviewCommand => {
  const loadedConfig = readConfig({ projectDir: consumerRoot });
  if (
    loadedConfig.failure !== null &&
    loadedConfig.failure.kind !== "missing-file"
  )
    fail("The consumer review configuration is invalid.");
  return loadedConfig.config.projectIdentity.reviewCommand;
};

const run = (): void => {
  const recordDir = argValue("--record-dir");
  const gate = argValue("--gate");
  const pullRequestArg = argValue("--pr");
  if (recordDir === null) fail("--record-dir is required (a bare record name)");
  if (gate === null) fail("--gate is required");
  if (pullRequestArg === null) fail("--pr is required");
  const pullRequestNumber = Number(pullRequestArg);
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0)
    fail("--pr must be a positive integer");

  const consumerRoot =
    process.env["RIN_GATES_WORKSPACE_ROOT"] ?? INVOKING_CHECKOUT;
  const workflowExecutor = createNodeWorkflowUtilityExecutor();
  const workflowSelection = resolveConsumerWorkflowContext({
    consumerRoot,
    engineUtilityPath:
      process.env["RIN_GATES_ENGINE_CLI"] ??
      join(INVOKING_CHECKOUT, ".claude", "tools", "aidlc-utility.ts"),
    rawSelectedSpace: process.env["RIN_GATES_SPACE"],
    executor: workflowExecutor,
  });
  if (workflowSelection.outcome === "failed") {
    fail(
      `Workflow selection refused: ${workflowSelection.consumerSpaceSelectionFailure.kind}.`,
    );
  }
  const { consumerWorkflowContext } = workflowSelection;
  const reviewCommand = reviewCommandFor({ consumerRoot });
  const executor = createNodeReviewCommandExecutor();
  const ports: BridgePorts = {
    readVerdictFile,
    readPullRequest,
    readReviews,
    postReview: createReviewPostPort({
      reviewCommand,
      executor,
    }),
  };

  const verdictPath = verdictPathFor({
    workspaceRoot: consumerWorkflowContext.consumerRoot,
    space: consumerWorkflowContext.space,
    recordDir,
    gate,
  });
  if (verdictPath === null) fail(`unknown gate slug: ${gate}`);

  const result = bridgeBoardVerdict({
    verdictPath,
    pullRequestNumber,
    ports,
  });

  reportBridgeResult({ result, pullRequestNumber });
};

const main = (): void => {
  try {
    run();
  } catch (thrown) {
    if (!isUsageRefusal(thrown)) throw thrown;
    console.error(`rin-gates-board-bridge: ${thrown.message}`);
    process.exit(1);
  }
};

if (import.meta.main) main();

export type {
  CreateNodeReviewCommandExecutor,
  ReviewCommandExecution,
  ReviewCommandExecutor,
};
export {
  createNodeReviewCommandExecutor,
  createReviewPostPort,
  PullRequestStateSchema,
  ReviewsPayloadSchema,
  verdictPathFor,
};
