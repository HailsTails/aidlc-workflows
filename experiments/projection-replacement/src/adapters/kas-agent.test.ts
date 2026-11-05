import { expect, mock, test } from "bun:test";
import { workerBinding } from "../../__tests__/worker-policy-fixtures.ts";
import { kasPolicy, kasMetricsInput } from "../../__tests__/agent-native-fixtures.ts";
import { createKasAgentEmitter, parseKasWorkerPolicy, specializeKasWorkerPolicy } from "./kas-agent.ts";

test("KAS specialization retains the full bound native policy", () => {
  expect(specializeKasWorkerPolicy({ policy: { ...kasPolicy, origin: workerBinding.template.origin, name: workerBinding.template.name }, binding: workerBinding, targetPolicy: kasPolicy })).toEqual({ status: "ok", value: { ...kasPolicy, origin: workerBinding.template.origin, binding: workerBinding, targetOrigin: kasPolicy.origin, targetBasis: { kind: "native-source" } } });
});
test("KAS refuses command-only policy reuse without target facts", () => {
  expect(specializeKasWorkerPolicy({ policy: { ...kasPolicy, origin: workerBinding.template.origin, name: workerBinding.template.name }, binding: workerBinding })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: "KAS specialization requires the complete target native policy; command admissions alone do not establish policy equivalence" }] });
});
test("a KAS extension declaration cannot bypass its source basis", () => {
  expect(specializeKasWorkerPolicy({ policy: { ...kasPolicy, origin: workerBinding.template.origin, name: workerBinding.template.name }, binding: workerBinding, targetPolicy: kasPolicy, targetBasis: { kind: "declared-extension", pin: "another-pin" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "test-pro-metrics-agent", detail: "KAS target policy must name the bound target and source pin" }] });
});
test("KAS refuses a declared target with different native permissions", () => {
  expect(specializeKasWorkerPolicy({ policy: { ...kasPolicy, origin: workerBinding.template.origin, name: workerBinding.template.name }, binding: workerBinding, targetPolicy: { ...kasPolicy, contract: { ...kasPolicy.contract, tools: ["read"] } } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: "KAS native policies differ; preserve the target permissions or prepare explicit source-backed differences" }] });
});
test("KAS refuses another template after policy binding", () => {
  expect(specializeKasWorkerPolicy({ policy: kasPolicy, binding: workerBinding })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: workerBinding.target.name, detail: "KAS specialization requires the bound native policy template" }] });
});

test.each([
  {
    lines: [
      'tools: ["read", "write", "shell"]',
      "includeMcpJson: true",
      "permissions:",
      "  rules: []",
    ],
  },
  { lines: ['tools: ["read", "write", "shell"]', "permissions:", "  rules: []"] },
])("KAS retains each actual worker policy shape", ({ lines }) => {
  expect(
    parseKasWorkerPolicy({
      input: lines,
      origin: kasPolicy.origin,
      name: "test-pro-metrics-agent",
      yaml: {
        decode: mock().mockReturnValue({
          status: "ok",
          value: { tools: ["read", "write", "shell"], permissions: { rules: [] } },
        }),
      },
    }),
  ).toEqual({
    status: "ok",
    value: { origin: kasPolicy.origin, name: "test-pro-metrics-agent", lines, contract: { tools: ["read", "write", "shell"], permissions: { rules: [] } } },
  });
});
test("KAS rejects worker policies with delegation tools", () => {
  expect(
    parseKasWorkerPolicy({
      input: ['tools: ["read", "write", "shell", "agent"]', "permissions:"],
      yaml: {
        decode: mock().mockReturnValue({
          status: "ok",
          value: { tools: ["read", "write", "shell", "agent"], permissions: { rules: [] } },
        }),
      },
      origin: kasPolicy.origin,
      name: "test-pro-metrics-agent",
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "KAS worker policy requires valid leaf tools and complete native permission rules",
      },
    ],
  });
});
test("KAS forwards selected worker permissions and uses effortLevel", () => {
  const frontmatter = mock().mockReturnValue("native header");
  const persona = mock().mockReturnValue("native persona");
  const emitted = createKasAgentEmitter({
    policy: kasPolicy,
    formatters: { frontmatter, persona },
  }).emit(kasMetricsInput);
  expect(emitted).toEqual({
    status: "ok",
    value: [
      { kind: "file", path: ".kiro/agents/test-pro-metrics-agent.md", body: "native persona" },
    ],
  });
  expect(frontmatter).toHaveBeenCalledWith({
    frontmatter: kasMetricsInput.frontmatter,
    nativeModel: { model: null, effort: null },
    effortKey: "effortLevel",
    removeKeys: ["disallowedTools"],
    additions: kasPolicy.lines,
  });
  expect(persona).toHaveBeenCalledWith({ input: kasMetricsInput, frontmatter: "native header" });
});
test("KAS refuses policy reuse across pins", () => {
  expect(
    createKasAgentEmitter({
      policy: { ...kasPolicy, origin: { ...kasPolicy.origin, pin: "other" } },
    }).emit(kasMetricsInput),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "foreign-content",
        subject: "test-pro-metrics-agent",
        detail: "KAS worker permissions belong to another persona or source pin",
      },
    ],
  });
});
