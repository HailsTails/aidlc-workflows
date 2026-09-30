import { describe, expect, test } from "vitest";
import {
  createNodeWorkflowUtilityExecutor,
  resolveConsumerWorkflowContext,
  type WorkflowUtilityExecutor,
} from "./rin-gates-workflow-selection.ts";

const request = {
  consumerRoot: "/consumer",
  engineUtilityPath: "/engine/aidlc-utility.ts",
};

const completed = ({ stdout }: { readonly stdout: string }) => ({
  kind: "completed" as const,
  processStatus: 0,
  stdout,
  stderr: "",
});

describe("resolveConsumerWorkflowContext", () => {
  test("passes a valid selected space to the utility as literal argv", () => {
    const commands: {
      readonly executable: string;
      readonly commandArguments: readonly string[];
    }[] = [];
    const executor: WorkflowUtilityExecutor = {
      execute: (command) => {
        commands.push(command);
        return completed({
          stdout: '{"space":"alpha-team","active":null,"intents":[]}',
        });
      },
    };

    expect(
      resolveConsumerWorkflowContext({
        ...request,
        rawSelectedSpace: "alpha-team",
        executor,
      }),
    ).toEqual({
      outcome: "ok",
      consumerWorkflowContext: {
        consumerRoot: "/consumer",
        space: "alpha-team",
        intentsRoot: "/consumer/aidlc/spaces/alpha-team/intents",
      },
    });
    expect(commands).toEqual([
      {
        executable: "bun",
        commandArguments: [
          "/engine/aidlc-utility.ts",
          "--project-dir",
          "/consumer",
          "intent",
          "list",
          "--json",
          "--space",
          "alpha-team",
        ],
      },
    ]);
  });

  test("uses the utility-selected space when no raw selector is supplied", () => {
    const executor: WorkflowUtilityExecutor = {
      execute: () =>
        completed({ stdout: '{"space":"default","active":null,"intents":[]}' }),
    };

    expect(
      resolveConsumerWorkflowContext({
        ...request,
        rawSelectedSpace: undefined,
        executor,
      }),
    ).toEqual({
      outcome: "ok",
      consumerWorkflowContext: {
        consumerRoot: "/consumer",
        space: "default",
        intentsRoot: "/consumer/aidlc/spaces/default/intents",
      },
    });
  });

  test("refuses an invalid raw selector before invoking the utility", () => {
    let calls = 0;
    const result = resolveConsumerWorkflowContext({
      ...request,
      rawSelectedSpace: "../outside",
      executor: {
        execute: () => {
          calls += 1;
          return completed({ stdout: '{"space":"default"}' });
        },
      },
    });

    expect(result).toMatchObject({
      outcome: "failed",
      consumerSpaceSelectionFailure: { kind: "selected-space-invalid" },
    });
    expect(calls).toBe(0);
  });

  test.each([
    {
      execution: { kind: "launch-failed" as const },
      failure: {
        kind: "utility-unavailable",
        engineUtilityPath: "/engine/aidlc-utility.ts",
      },
    },
    {
      execution: { kind: "interrupted" as const, terminationSignal: "SIGTERM" },
      failure: { kind: "utility-interrupted", terminationSignal: "SIGTERM" },
    },
    {
      execution: {
        kind: "completed" as const,
        processStatus: 7,
        stdout: "",
        stderr: "selection refused",
      },
      failure: {
        kind: "utility-refused",
        processStatus: 7,
        refusalDetail: "selection refused",
      },
    },
  ])("maps utility $execution.kind", ({ execution, failure }) => {
    expect(
      resolveConsumerWorkflowContext({
        ...request,
        rawSelectedSpace: undefined,
        executor: { execute: () => execution },
      }),
    ).toEqual({
      outcome: "failed",
      consumerSpaceSelectionFailure: failure,
    });
  });

  test.each([
    { label: "invalid JSON", stdout: "not JSON" },
    { label: "a missing space", stdout: "{}" },
    { label: "an invalid space", stdout: '{"space":"../../outside"}' },
  ])("refuses successful utility output with $label", ({ stdout }) => {
    expect(
      resolveConsumerWorkflowContext({
        ...request,
        rawSelectedSpace: undefined,
        executor: {
          execute: () => completed({ stdout }),
        },
      }),
    ).toMatchObject({
      outcome: "failed",
      consumerSpaceSelectionFailure: { kind: "selection-output-malformed" },
    });
  });
});

test("maps Node-rejected utility arguments to launch failure data", () => {
  expect(
    createNodeWorkflowUtilityExecutor().execute({
      executable: "bun",
      commandArguments: ["invalid\u0000argument"],
    }),
  ).toEqual({ kind: "launch-failed" });
});
