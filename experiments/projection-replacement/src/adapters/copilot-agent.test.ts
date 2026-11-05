import { expect, mock, test } from "bun:test";
import { copilotMetricsInput } from "../../__tests__/agent-native-fixtures.ts";
import { createCopilotAgentEmitter } from "./copilot-agent.ts";

test("Copilot translates leaf delegation to its native allowlist without a model pin", () => {
  const frontmatter = mock()
    .mockReturnValueOnce("native header")
    .mockReturnValueOnce("engine header");
  const persona = mock()
    .mockReturnValueOnce("native persona")
    .mockReturnValueOnce("engine persona");
  const emitted = createCopilotAgentEmitter({ formatters: { frontmatter, persona } }).emit(
    copilotMetricsInput,
  );
  expect(emitted).toEqual({
    status: "ok",
    value: [
      { kind: "file", path: ".github/agents/test-pro-metrics-agent.md", body: "native persona" },
      { kind: "file", path: ".aidlc/agents/test-pro-metrics-agent.md", body: "engine persona" },
    ],
  });
  expect(frontmatter).toHaveBeenNthCalledWith(1, {
    frontmatter: copilotMetricsInput.frontmatter,
    nativeModel: { model: null, effort: null },
    effortKey: "effort",
    removeKeys: ["disallowedTools"],
    additions: ['tools: ["read", "edit", "search", "execute", "web", "todo"]'],
  });
  expect(frontmatter).toHaveBeenNthCalledWith(2, {
    frontmatter: copilotMetricsInput.frontmatter,
    nativeModel: { model: null, effort: null },
    effortKey: "effort",
    removeKeys: [],
    additions: [],
  });
  expect(persona).toHaveBeenNthCalledWith(1, {
    input: copilotMetricsInput,
    frontmatter: "native header",
  });
  expect(persona).toHaveBeenNthCalledWith(2, {
    input: copilotMetricsInput,
    frontmatter: "engine header",
  });
});
test("Copilot refuses an incompatible prepared dial rather than silently discarding it", () => {
  const frontmatter = mock();
  const persona = mock();
  expect(
    createCopilotAgentEmitter({ formatters: { frontmatter, persona } }).emit({
      ...copilotMetricsInput,
      nativeModel: { model: "sonnet", effort: null },
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "Copilot worker agents inherit the session model and effort",
      },
    ],
  });
  expect(frontmatter).not.toHaveBeenCalled();
  expect(persona).not.toHaveBeenCalled();
});
