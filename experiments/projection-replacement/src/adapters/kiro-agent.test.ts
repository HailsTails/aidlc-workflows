import { expect, mock, test } from "bun:test";
import { workerTemplate, workerBinding, specializedKiro, declaredMetricsProfile, kiroBehaviorDifferenceCases } from "../../__tests__/worker-policy-fixtures.ts";
import {
  authoredKiroProfile,
  preparedKiroProfile,
  rawKiroProfile,
  nativePolicyOrigin,
  preparedKiroJson,
  kiroMetricsInput,
  delegatedKiroProfileCases,
  ordinaryKiroSelectorCases,
  mcpKiroProfileText,
  kiroAliasCases,
  selectedModelKiroJson,
} from "../../__tests__/agent-native-fixtures.ts";
import {
  createKiroAgentEmitter,
  parseKiroAgentProfile,
  prepareKiroAgentProfile,
  kiroCopyCommandPatterns,
  specializeKiroWorkerProfile,
} from "./kiro-agent.ts";

test("a resolved model override affects native JSON while preserving prompt metadata", () => {
  const frontmatter = mock().mockReturnValue("header");
  const persona = mock().mockReturnValue("persona");
  expect(createKiroAgentEmitter({ profile: preparedKiroProfile, promptAdditions: [], modelOverride: "claude-sonnet-4.6", formatters: { frontmatter, persona } }).emit(kiroMetricsInput)).toEqual({ status: "ok", value: [{ kind: "file", path: ".kiro/agents/test-pro-metrics-agent.md", body: "persona" }, { kind: "file", path: ".kiro/agents/test-pro-metrics-agent.json", body: selectedModelKiroJson }] });
  expect(frontmatter).toHaveBeenCalledWith({ frontmatter: kiroMetricsInput.frontmatter, nativeModel: kiroMetricsInput.nativeModel, effortKey: "effort", removeKeys: ["disallowedTools"], additions: [] });
});

test.each(kiroBehaviorDifferenceCases)("Kiro specialization requires equivalent native $field", ({ field, profile }) => {
  expect(specializeKiroWorkerProfile({ profile: workerTemplate, binding: workerBinding, targetProfile: profile })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: `Kiro native policies differ in ${field}; preserve the target policy or prepare explicit source-backed differences` }] });
});
test("Kiro refuses command-only policy reuse without target facts", () => {
  expect(specializeKiroWorkerProfile({ profile: workerTemplate, binding: workerBinding })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: "Kiro specialization requires the complete target native policy; command admissions alone do not establish policy equivalence" }] });
});
test("an extension declaration cannot change its source basis to bypass pin agreement", () => {
  expect(specializeKiroWorkerProfile({ profile: workerTemplate, binding: workerBinding, targetProfile: declaredMetricsProfile, targetBasis: { kind: "declared-extension", pin: "another-pin" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "test-pro-metrics-agent", detail: "Kiro target policy must name the bound target and source pin" }] });
});

test("Kiro specializes known identity slots while retaining native policy and denials", () => {
  expect(specializeKiroWorkerProfile({ profile: workerTemplate, binding: workerBinding, targetProfile: declaredMetricsProfile })).toEqual({ status: "ok", value: specializedKiro });
});
test("Kiro refuses unknown role-specific template references", () => {
  expect(specializeKiroWorkerProfile({ profile: { ...workerTemplate, resources: ["file://.kiro/private/aidlc-quality-agent.md"] }, binding: workerBinding, targetProfile: declaredMetricsProfile })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: workerBinding.target.name, detail: "Kiro template contains role-specific resource or hook bindings that require explicit preparation" }] });
});
test("Kiro refuses another template after policy binding", () => {
  expect(specializeKiroWorkerProfile({ profile: { ...workerTemplate, origin: { ...workerTemplate.origin, path: "other.json" } }, binding: workerBinding, targetProfile: declaredMetricsProfile })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: workerBinding.target.name, detail: "Kiro specialization requires the bound authored policy template" }] });
});

test.each(kiroAliasCases)("Kiro validates native keys before translation: $label", ({
  text,
  expectedDetail,
}) => {
  expect(parseKiroAgentProfile({ text, origin: nativePolicyOrigin })).toEqual({
    status: "invalid",
    findings: [{ code: "invalid-input", subject: nativePolicyOrigin.path, detail: expectedDetail }],
  });
});

test("Kiro boundary retains source-native descriptions, denials, resources and hook units", () => {
  expect(parseKiroAgentProfile({ text: rawKiroProfile, origin: nativePolicyOrigin })).toEqual({
    status: "ok",
    value: authoredKiroProfile,
  });
});
test("malformed Kiro JSON is an operational finding", () => {
  expect(parseKiroAgentProfile({ text: "{", origin: nativePolicyOrigin })).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-json",
        subject: nativePolicyOrigin.path,
        detail: "expected authored Kiro agent JSON",
      },
    ],
  });
});
test.each(delegatedKiroProfileCases)("Kiro leaf profiles refuse $label", ({ text, expectedDetail }) => {
  expect(parseKiroAgentProfile({ text, origin: nativePolicyOrigin })).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: expectedDetail,
      },
    ],
  });
});
test.each(delegatedKiroProfileCases)("prepared profile cannot bypass the leaf requirement with $label", ({ selector, expectedDetail }) => {
  const frontmatter = mock();
  const persona = mock();
  expect(createKiroAgentEmitter({ profile: { ...preparedKiroProfile, tools: ["fs_read", selector] }, promptAdditions: [], formatters: { frontmatter, persona } }).emit(kiroMetricsInput)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: expectedDetail }] });
  expect(frontmatter).not.toHaveBeenCalled();
  expect(persona).not.toHaveBeenCalled();
});
test.each(ordinaryKiroSelectorCases)("native leaf guard preserves non-delegation selector $selector", ({ text, selector }) => {
  expect(parseKiroAgentProfile({ text, origin: nativePolicyOrigin })).toEqual({ status: "ok", value: { ...authoredKiroProfile, tools: ["fs_read", selector] } });
});
test("MCP tool names containing agent are not native delegation tools", () => {
  expect(parseKiroAgentProfile({ text: mcpKiroProfileText, origin: nativePolicyOrigin })).toEqual({
    status: "ok",
    value: { ...authoredKiroProfile, tools: ["fs_read", "@my-agent"] },
  });
});
test("Kiro preparation consumes resolved grants, preserves denials and substitutes hook commands literally", () => {
  expect(
    prepareKiroAgentProfile({
      profile: authoredKiroProfile,
      shellCommands: ["prepared command"],
      sharedResources: ["file://.kiro/knowledge/aidlc-shared/method.md"],
      invocation: "echo $&",
      hookSuffix: "; exit $LASTEXITCODE",
    }),
  ).toEqual({ status: "ok", value: preparedKiroProfile });
});
test("Kiro preparation refuses missing resolved allowances", () => {
  expect(
    prepareKiroAgentProfile({
      profile: authoredKiroProfile,
      shellCommands: [],
      sharedResources: null,
      invocation: "bun .kiro/tools/aidlc.ts",
      hookSuffix: "",
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "Kiro shell grants require resolved dispatcher/tool allowances",
      },
    ],
  });
});
test("custom authored shell allowances are not overwritten by broad-pattern preparation", () => {
  expect(
    prepareKiroAgentProfile({
      profile: { ...authoredKiroProfile, shellCommands: ["custom command"] },
      shellCommands: ["prepared command"],
      sharedResources: null,
      invocation: "bun .kiro/tools/aidlc.ts",
      hookSuffix: "",
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail:
          "Kiro grant preparation requires the authored tool-script pattern; custom allowances need their own policy preparation",
      },
    ],
  });
});
test("Kiro emits prepared native JSON and the separate prompt metadata from its manifest", () => {
  const frontmatter = mock().mockReturnValue("native header");
  const persona = mock().mockReturnValue("native persona");
  const emitted = createKiroAgentEmitter({
    profile: preparedKiroProfile,
    promptAdditions: [],
    formatters: { frontmatter, persona },
  }).emit(kiroMetricsInput);
  expect(emitted).toEqual({
    status: "ok",
    value: [
      { kind: "file", path: ".kiro/agents/test-pro-metrics-agent.md", body: "native persona" },
      { kind: "file", path: ".kiro/agents/test-pro-metrics-agent.json", body: preparedKiroJson },
    ],
  });
  expect(frontmatter).toHaveBeenCalledWith({
    frontmatter: kiroMetricsInput.frontmatter,
    nativeModel: { model: null, effort: null },
    effortKey: "effort",
    removeKeys: ["disallowedTools"],
    additions: [],
  });
  expect(persona).toHaveBeenCalledWith({ input: kiroMetricsInput, frontmatter: "native header" });
});
test("Kiro refuses per-agent effort rather than emitting an unsupported native field", () => {
  const frontmatter = mock();
  const persona = mock();
  expect(
    createKiroAgentEmitter({
      profile: preparedKiroProfile,
      promptAdditions: [],
      formatters: { frontmatter, persona },
    }).emit({ ...kiroMetricsInput, nativeModel: { model: null, effort: "high" } }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "Kiro agent JSON has no native per-agent effort field",
      },
    ],
  });
  expect(frontmatter).not.toHaveBeenCalled();
  expect(persona).not.toHaveBeenCalled();
});
test("Kiro refuses a native profile from another pin", () => {
  expect(
    createKiroAgentEmitter({
      profile: { ...preparedKiroProfile, origin: { ...nativePolicyOrigin, pin: "another-pin" } },
      promptAdditions: [],
    }).emit(kiroMetricsInput),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "foreign-content",
        subject: "test-pro-metrics-agent",
        detail: "Kiro native profile must reference this persona and source pin",
      },
    ],
  });
});
test.each([
  {
    dialect: "paired-quotes" as const,
    expected: [
      "bun (run )?(\\.kiro/tools/aidlc\\.ts|\"\\.kiro/tools/aidlc\\.ts\"|'\\.kiro/tools/aidlc\\.ts') engine( .*)?",
      "bun (run )?(\\.kiro/tools/aidlc\\.ts|\"\\.kiro/tools/aidlc\\.ts\"|'\\.kiro/tools/aidlc\\.ts') doctor",
      "bun (run )?(\\.kiro/tools/aidlc-audit\\.ts|\"\\.kiro/tools/aidlc-audit\\.ts\"|'\\.kiro/tools/aidlc-audit\\.ts')( .*)?",
    ],
  },
  {
    dialect: "optional-quotes" as const,
    expected: [
      "bun (run )?[\"']?\\.kiro/tools/aidlc\\.ts[\"']? engine( .*)?",
      "bun (run )?[\"']?\\.kiro/tools/aidlc\\.ts[\"']? doctor",
      "bun (run )?[\"']?\\.kiro/tools/(aidlc-audit)\\.ts[\"']?( .*)?",
    ],
  },
])("Kiro command pattern dialect is explicit: $dialect", ({ dialect, expected }) => {
  expect(
    kiroCopyCommandPatterns({
      dispatcherCommands: ["doctor"],
      toolScripts: ["aidlc-audit.ts"],
      dialect,
    }),
  ).toEqual(expected);
});
