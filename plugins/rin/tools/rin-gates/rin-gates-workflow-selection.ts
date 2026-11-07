import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { z } from "zod";

declare const spaceNameBrand: unique symbol;

type SpaceName = string & {
  readonly [spaceNameBrand]: "SpaceName";
};

type ConsumerWorkflowContext = {
  readonly consumerRoot: string;
  readonly space: SpaceName;
  readonly intentsRoot: string;
};

type ConsumerSpaceSelectionFailure =
  | {
      readonly kind: "selected-space-invalid";
      readonly invalidSelectionDetail: string;
    }
  | { readonly kind: "utility-unavailable"; readonly engineUtilityPath: string }
  | {
      readonly kind: "utility-refused";
      readonly processStatus: number;
      readonly refusalDetail: string;
    }
  | {
      readonly kind: "utility-interrupted";
      readonly terminationSignal: string;
    }
  | {
      readonly kind: "selection-output-malformed";
      readonly malformedOutputDetail: string;
    };

type ConsumerSpaceSelectionResult =
  | {
      readonly outcome: "ok";
      readonly consumerWorkflowContext: ConsumerWorkflowContext;
    }
  | {
      readonly outcome: "failed";
      readonly consumerSpaceSelectionFailure: ConsumerSpaceSelectionFailure;
    };

type WorkflowUtilityExecution =
  | {
      readonly kind: "completed";
      readonly processStatus: number;
      readonly stdout: string;
      readonly stderr: string;
    }
  | { readonly kind: "launch-failed" }
  | { readonly kind: "interrupted"; readonly terminationSignal: string };

type WorkflowUtilityExecutor = {
  readonly execute: (workflowUtilityCommand: {
    readonly executable: "bun";
    readonly commandArguments: readonly string[];
    readonly workingDirectory?: string;
  }) => WorkflowUtilityExecution;
};

type ConsumerWorkflowSelectionRequest = {
  readonly consumerRoot: string;
  readonly engineUtilityPath: string;
  readonly rawSelectedSpace: string | undefined;
  readonly executor: WorkflowUtilityExecutor;
};

type ResolveConsumerWorkflowContext = (
  consumerWorkflowSelectionRequest: ConsumerWorkflowSelectionRequest,
) => ConsumerSpaceSelectionResult;

type CreateNodeWorkflowUtilityExecutor = () => WorkflowUtilityExecutor;

const rawSelectedSpaceSchema = z.custom<SpaceName>(
  (spaceNameCandidate) =>
    typeof spaceNameCandidate === "string" &&
    /^[a-z][a-z0-9-]*$/.test(spaceNameCandidate),
);

const utilitySelectionSchema = z.object({
  space: z.custom<SpaceName>(
    (spaceNameCandidate) =>
      typeof spaceNameCandidate === "string" &&
      /^[a-z][a-z0-9-]*$/.test(spaceNameCandidate),
  ),
});

const failed = (
  consumerSpaceSelectionFailure: ConsumerSpaceSelectionFailure,
): ConsumerSpaceSelectionResult => ({
  outcome: "failed",
  consumerSpaceSelectionFailure,
});

const workflowUtilityCommand = ({
  consumerRoot,
  engineUtilityPath,
  selectedSpace,
}: {
  readonly consumerRoot: string;
  readonly engineUtilityPath: string;
  readonly selectedSpace: SpaceName | undefined;
}): {
  readonly executable: "bun";
  readonly commandArguments: readonly string[];
} => ({
  executable: "bun",
  commandArguments: [
    engineUtilityPath,
    "--project-dir",
    consumerRoot,
    "intent",
    "list",
    "--json",
    ...(selectedSpace === undefined ? [] : ["--space", selectedSpace]),
  ],
});

const createNodeWorkflowUtilityExecutor: CreateNodeWorkflowUtilityExecutor =
  () => ({
    execute: ({ executable, commandArguments, workingDirectory }) => {
      try {
        const result = spawnSync(executable, [...commandArguments], {
          ...(workingDirectory === undefined ? {} : { cwd: workingDirectory }),
          env: process.env,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (result.error) return { kind: "launch-failed" };
        if (result.signal)
          return { kind: "interrupted", terminationSignal: result.signal };
        if (result.status === null) return { kind: "launch-failed" };
        return {
          kind: "completed",
          processStatus: result.status,
          stdout: String(result.stdout ?? ""),
          stderr: String(result.stderr ?? ""),
        };
      } catch {
        return { kind: "launch-failed" };
      }
    },
  });

const resolveConsumerWorkflowContext: ResolveConsumerWorkflowContext = ({
  consumerRoot,
  engineUtilityPath,
  rawSelectedSpace,
  executor,
}) => {
  const selectedSpace =
    rawSelectedSpace === undefined
      ? undefined
      : rawSelectedSpaceSchema.safeParse(rawSelectedSpace);
  if (selectedSpace !== undefined && !selectedSpace.success) {
    return failed({
      kind: "selected-space-invalid",
      invalidSelectionDetail: "RIN_GATES_SPACE must be a lowercase space name",
    });
  }
  const execution = executor.execute(
    workflowUtilityCommand({
      consumerRoot,
      engineUtilityPath,
      selectedSpace: selectedSpace?.data,
    }),
  );
  if (execution.kind === "launch-failed") {
    return failed({ kind: "utility-unavailable", engineUtilityPath });
  }
  if (execution.kind === "interrupted") {
    return failed({
      kind: "utility-interrupted",
      terminationSignal: execution.terminationSignal,
    });
  }
  if (execution.processStatus !== 0) {
    return failed({
      kind: "utility-refused",
      processStatus: execution.processStatus,
      refusalDetail: execution.stderr,
    });
  }
  let utilityOutput: unknown;
  try {
    utilityOutput = JSON.parse(execution.stdout);
  } catch {
    return failed({
      kind: "selection-output-malformed",
      malformedOutputDetail: "intent list did not return JSON",
    });
  }
  const decoded = utilitySelectionSchema.safeParse(utilityOutput);
  if (!decoded.success) {
    return failed({
      kind: "selection-output-malformed",
      malformedOutputDetail: decoded.error.issues
        .map((issue) => issue.message)
        .join("; "),
    });
  }
  return {
    outcome: "ok",
    consumerWorkflowContext: {
      consumerRoot,
      space: decoded.data.space,
      intentsRoot: join(
        consumerRoot,
        "aidlc",
        "spaces",
        decoded.data.space,
        "intents",
      ),
    },
  };
};

export type {
  ConsumerSpaceSelectionFailure,
  ConsumerSpaceSelectionResult,
  ConsumerWorkflowContext,
  ConsumerWorkflowSelectionRequest,
  CreateNodeWorkflowUtilityExecutor,
  ResolveConsumerWorkflowContext,
  SpaceName,
  WorkflowUtilityExecution,
  WorkflowUtilityExecutor,
};
export { createNodeWorkflowUtilityExecutor, resolveConsumerWorkflowContext };
