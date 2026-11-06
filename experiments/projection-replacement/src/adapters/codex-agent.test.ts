import { expect, mock, test } from "bun:test";
import { codexMetricsInput } from "../../__tests__/agent-native-fixtures.ts";
import { createCodexAgentEmitter } from "./codex-agent.ts";

test("Codex emits a native TOML role and keeps the engine persona", () => {
  const frontmatter = mock().mockReturnValue("engine header");
  const persona = mock().mockReturnValue("engine persona");
  const emitted = createCodexAgentEmitter({ formatters: { frontmatter, persona } }).emit(
    codexMetricsInput,
  );
  expect(emitted).toEqual({
    status: "ok",
    value: [
      {
        kind: "file",
        path: ".codex/agents/test-pro-metrics-agent.toml",
        body: 'name = "test-pro-metrics-agent"\ndescription = "Metrics specialist"\ndeveloper_instructions = """\nPrepared preflight\n\nProjected metrics body.\n"""\n',
      },
      { kind: "file", path: ".codex/agents/test-pro-metrics-agent.md", body: "engine persona" },
    ],
  });
  expect(frontmatter).toHaveBeenCalledWith({
    frontmatter: codexMetricsInput.frontmatter,
    nativeModel: { model: null, effort: null },
    effortKey: "effort",
    removeKeys: [],
    additions: [],
  });
  expect(persona).toHaveBeenCalledWith({ input: codexMetricsInput, frontmatter: "engine header" });
});
test("Codex escapes TOML delimiters and backslashes without interpreting literal dollars", () => {
  const frontmatter = mock().mockReturnValue("engine header");
  const persona = mock().mockReturnValue("engine persona");
  const emitted = createCodexAgentEmitter({ formatters: { frontmatter, persona } }).emit({
    ...codexMetricsInput,
    preflight: "Prepared",
    body: 'Windows C:\\repo\nQuotes """ and $&\n',
    nativeModel: { model: "provider/model", effort: "high" },
  });
  expect(emitted).toEqual({
    status: "ok",
    value: [
      {
        kind: "file",
        path: ".codex/agents/test-pro-metrics-agent.toml",
        body: 'name = "test-pro-metrics-agent"\ndescription = "Metrics specialist"\nmodel = "provider/model"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = """\nPrepared\n\nWindows C:\\\\repo\nQuotes \\"\\"\\" and $&\n"""\n',
      },
      { kind: "file", path: ".codex/agents/test-pro-metrics-agent.md", body: "engine persona" },
    ],
  });
});
