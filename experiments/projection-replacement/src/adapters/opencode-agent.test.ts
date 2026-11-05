import { expect, mock, test } from "bun:test";
import { opencodeMetricsInput } from "../../__tests__/agent-native-fixtures.ts";
import { createOpencodeAgentEmitter } from "./opencode-agent.ts";

test("OpenCode projects authored maxTurns to native steps and changes only the native citation", () => {
  const frontmatter = mock().mockReturnValue("header");
  const persona = mock().mockReturnValue("persona");
  const input = { ...opencodeMetricsInput, policy: { ...opencodeMetricsInput.policy, turnLimit: 60 }, body: "Budget `maxTurns: 60`." };
  createOpencodeAgentEmitter({ formatters: { frontmatter, persona } }).emit(input);
  expect(frontmatter).toHaveBeenNthCalledWith(1, { frontmatter: input.frontmatter, nativeModel: input.nativeModel, effortKey: "variant", removeKeys: ["disallowedTools", "maxTurns"], additions: ["mode: subagent", "steps: 60", "permission:", "  task: deny"] });
  expect(persona).toHaveBeenNthCalledWith(1, { input: { ...input, body: "Budget `steps: 60`." }, frontmatter: "header" });
  expect(persona).toHaveBeenNthCalledWith(2, { input, frontmatter: "header" });
});

test("OpenCode uses subagent mode, task denial and variant while preserving the engine copy", () => {
  const frontmatter = mock()
    .mockReturnValueOnce("native header")
    .mockReturnValueOnce("engine header");
  const persona = mock()
    .mockReturnValueOnce("native persona")
    .mockReturnValueOnce("engine persona");
  const emitted = createOpencodeAgentEmitter({ formatters: { frontmatter, persona } }).emit(
    opencodeMetricsInput,
  );
  expect(emitted).toEqual({
    status: "ok",
    value: [
      { kind: "file", path: ".opencode/agents/test-pro-metrics-agent.md", body: "native persona" },
      { kind: "file", path: ".aidlc/agents/test-pro-metrics-agent.md", body: "engine persona" },
    ],
  });
  expect(frontmatter).toHaveBeenNthCalledWith(1, {
    frontmatter: opencodeMetricsInput.frontmatter,
    nativeModel: { model: null, effort: "medium" },
    effortKey: "variant",
    removeKeys: ["disallowedTools", "maxTurns"],
    additions: ["mode: subagent", "permission:", "  task: deny"],
  });
  expect(frontmatter).toHaveBeenNthCalledWith(2, {
    frontmatter: opencodeMetricsInput.frontmatter,
    nativeModel: { model: null, effort: "medium" },
    effortKey: "variant",
    removeKeys: [],
    additions: [],
  });
  expect(persona).toHaveBeenNthCalledWith(1, {
    input: opencodeMetricsInput,
    frontmatter: "native header",
  });
  expect(persona).toHaveBeenNthCalledWith(2, {
    input: opencodeMetricsInput,
    frontmatter: "engine header",
  });
});
