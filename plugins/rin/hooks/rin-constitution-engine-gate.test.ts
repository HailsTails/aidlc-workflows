import { describe, expect, test } from "vitest";
import { defaultReviewProcessPort } from "../tools/rin-gates/review-process-port.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";

const processPort = defaultReviewProcessPort();
const pathOperations = defaultPathOperations();
const fileText = defaultFileTextPort();

const ENTRY_PATH = pathOperations.join({
  segments: [pathOperations.dirname({ path: pathOperations.fromFileUrl({ url: import.meta.url }) }), "rin-constitution-engine-gate.ts"],
});

const runEntry = ({ hookInput }: { readonly hookInput: string }) =>
  processPort.runSync({ program: "bun", args: [ENTRY_PATH], input: hookInput, environment: processPort.environment });

describe("rin-constitution-engine-gate entry", () => {
  test("an ordinary shell command exits 0", () => {
    expect(runEntry({ hookInput: JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }) }).status).toBe(0);
  });

  test("a stage completion outside any checkout exits 2, the blocking code", () => {
    const outsideCheckout = fileText.makeTemporaryDirectory(
      pathOperations.join({ segments: [fileText.temporaryRoot(), "rin-engine-gate-"] }),
    );
    const output = runEntry({
      hookInput: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "aidlc engine orchestrate report --result completed" },
        cwd: outsideCheckout,
      }),
    });
    fileText.remove(outsideCheckout, { recursive: true, force: true });
    expect(output.status).toBe(2);
    expect(output.stderr).toContain("no git checkout contains the command's working directory");
  });
});
