import { expect, test } from "vitest";
import { filesystemPorts } from "./rin-gates-promote.ts";
import type { WorkflowUtilityExecutor } from "./rin-gates-workflow-selection.ts";

test("promotion birth uses the selected space and consumer working directory", () => {
  const commands: Parameters<WorkflowUtilityExecutor["execute"]>[0][] = [];
  const ports = filesystemPorts({
    intentsRoot: "/consumer/aidlc/spaces/alpha/intents",
    space: "alpha",
    engineCli: "/engine/aidlc-utility.ts",
    now: () => new Date("2026-10-07T00:00:00Z"),
    executor: {
      execute: (command) => {
        commands.push(command);
        return { kind: "completed", processStatus: 0, stdout: "Intent born: 261007-example", stderr: "" };
      },
    },
  });
  expect(ports.birthIntent({
    scope: "feature", label: "example", promotionArguments: "existing framing", workspaceRoot: "/consumer",
  })).toEqual({ outcome: "ok", value: "261007-example" });
  expect(commands).toEqual([{
    executable: "bun",
    commandArguments: [
      "/engine/aidlc-utility.ts", "intent-create", "--scope", "feature", "--label", "example",
      "--project-dir", "/consumer", "--space", "alpha", "--arguments", "existing framing",
    ],
    workingDirectory: "/consumer",
  }]);
});
