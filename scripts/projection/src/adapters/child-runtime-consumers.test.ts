// Checks explicit compiler capability routing, including paths skipped by before-host preparation.
import { afterEach, expect, mock, test } from "bun:test";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessLimits, type NativeCompilerSpawnReply, type NativeCompilerTransport } from "./native-compiler-process.ts";
import { createNativeDocumentCommandPreparer } from "./native-document-commands.ts";
import { createNativeStageCommandPreparer } from "./native-stage-commands.ts";
import { createCoreAgentPolicyReader } from "./core-agent-policy.ts";
import { createRunnerProcess, createRunnerProcessOperations } from "./runner-process.ts";
import { createSourceHarnessSettingsPreparer, createSourceHarnessSettingsOperations } from "./source-harness-settings.ts";
import { createSourceRuntimeModuleOperations, createSourceRuntimeModulePreparer } from "./source-runtime-modules.ts";
import { createSourceRuntimeContractOperations } from "./source-runtime-contracts.ts";
import { createSourceRuntimeContextOperations } from "./source-runtime-context.ts";
import { createSourcePluginAuthoringOperations } from "./source-plugin-authoring.ts";
import { createSourceDescriptionOperations } from "./source-distribution-description.ts";
import { createOnboardingOperations } from "./onboarding-source.ts";
import { createWorkflowCompilerOperations } from "./workflow-source-compiler.ts";
import { createWorkflowReferenceOperations, createWorkflowReferencePreparer, type WorkflowReferenceRequest } from "./workflow-reference.ts";
import { createGuidanceBindingPreparer } from "./guidance-bindings.ts";
import { createHarnessDocumentPreparer } from "./harness-document-preparation.ts";
import { createCoreMethodRuntimeServices } from "../../examples/core-method-runtime.ts";
import { createCoreAgentProductServices } from "../../examples/core-agent-products.ts";
import { createCoreKnowledgeProductServices } from "../../examples/core-knowledge-products.ts";
import { createCoreSkillProductServices } from "../../examples/core-skill-products.ts";
import { createCoreSensorProductServices } from "../../examples/core-sensor-products.ts";
import { createCoreGuidanceProductServices } from "../../examples/core-guidance-products.ts";
import { createHarnessDocumentProductServices } from "../../examples/harness-document-products.ts";
import { createStageRuntimeServices } from "../../examples/stage-runtime.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../application/projection-set.ts";
import { createRuntimeDirectoryFixtures, runtimeDirectoryExists, runtimeDirectoryParent } from "../../../../tests/unit/projection/support/child-runtime-fixture.ts";
import { coreAgentSet, coreAgent, coreAgentContext, coreAgentCatalogue, coreAgentKnowledgeOrigin } from "../../../../tests/unit/projection/support/__tests__/core-agent-fixtures.ts";
import { coreKnowledgeSet } from "../../../../tests/unit/projection/support/__tests__/core-knowledge-fixtures.ts";
import { coreSensorSet } from "../../../../tests/unit/projection/support/__tests__/core-sensor-fixtures.ts";
import { assemblySkill, assemblyTarget } from "../../../../tests/unit/projection/support/__tests__/projection-set-fixtures.ts";
import { guidanceBindingRequest, createGuidanceBindingOperations as guidanceOperations } from "../../../../tests/unit/projection/support/__tests__/core-guidance-fixtures.ts";
import { entryPreparation, createEntryPreparationOperations, createEntryProse } from "../../../../tests/unit/projection/support/__tests__/harness-document-fixtures.ts";
import { nativeStageRequest } from "../../../../tests/unit/projection/support/__tests__/native-stage-fixtures.ts";
import { compiledWorkflow } from "../../../../tests/unit/projection/support/__tests__/workflow-compiler-fixtures.ts";

const sourceRoot = runtimeDirectoryParent(Bun.fileURLToPath(new URL("../../../../AGENTS.md", import.meta.url)));
const basis = { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } as const;
const context = { harness: "claude", directory: ".claude", invocation: "aidlc", rulesSubdir: "rules" } as const;
const fixtures = createRuntimeDirectoryFixtures();
afterEach(fixtures.cleanup);
const unavailable: NativeCompilerSpawnReply = { exitCode: 0, stdout: '{"status":"unavailable","detail":"selected compiler route"}', stderr: "", error: null };
const nativeRefusal = { status: "invalid", findings: [{ code: "capability-gap", subject: "native-document-commands", detail: "selected compiler route" }] } as const;
const recordedProcesses = (reply: NativeCompilerSpawnReply = unavailable) => {
  const environment = mock(() => Object.fromEntries([["PATH", "configured-bin"], ["SECRET", "not-forwarded"]]));
  const spawn = mock<NativeCompilerTransport["spawn"]>(() => reply);
  const processes = mock((limits?: NativeCompilerProcessLimits) => createNativeCompilerProcessOperations({ ...limits, transport: { environment, spawn } }));
  return { processes, spawn, environment };
};

test.each([
  ["runner", createRunnerProcessOperations], ["settings", createSourceHarnessSettingsOperations],
  ["runtime contracts", createSourceRuntimeContractOperations], ["runtime context", createSourceRuntimeContextOperations],
  ["plugin authoring", createSourcePluginAuthoringOperations], ["distribution description", createSourceDescriptionOperations],
  ["onboarding", createOnboardingOperations], ["workflow compiler", createWorkflowCompilerOperations],
] as const)("%s operations retain the supplied factory and default transport limits", (_name, create) => {
  const recorded = recordedProcesses();
  const operations = create({ processes: recorded.processes });
  expect(recorded.processes.mock.calls).toEqual([[]]);
  expect(operations.environment()).toEqual(Object.fromEntries([["PATH", "configured-bin"], ["SECRET", "not-forwarded"]]));
  const input = { binary: "selected-bun", args: ["compiler.ts"], cwd: sourceRoot, input: "request", env: Object.fromEntries([["PAYLOAD", "kept"]]) };
  expect(operations.spawn(input)).toEqual(unavailable);
  expect(recorded.spawn.mock.calls).toEqual([[{ ...input, timeout: 10000, maxBuffer: 8 * 1024 * 1024 }]]);
});

test("runtime module preparer requests its larger limits through the supplied factory", async () => {
  const recorded = recordedProcesses();
  const root = fixtures.create();
  const modulePreparation = await createSourceRuntimeModulePreparer({ processes: recorded.processes, binary: "selected-bun" }).prepare({ sourceRoot, root, basis, binding: context, invocation: "bun .claude/tools/aidlc.ts", mode: 0o644 });
  expect(modulePreparation).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-modules", detail: "selected compiler route" }] });
  expect(recorded.processes.mock.calls).toEqual([[{ timeout: 30000, maxBuffer: 32 * 1024 * 1024 }]]);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  expect(recorded.spawn.mock.calls[0]![0]).toMatchObject({ binary: "selected-bun", cwd: root, timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
});

test("explicit module operations take precedence over the process factory", async () => {
  const factory = recordedProcesses();
  const explicit = recordedProcesses();
  const operations = createSourceRuntimeModuleOperations({ processes: explicit.processes });
  const explicitModulePreparation = await createSourceRuntimeModulePreparer({ processes: factory.processes, operations }).prepare({ sourceRoot, root: fixtures.create(), basis, binding: context, invocation: "aidlc", mode: 0o644 });
  expect(explicitModulePreparation).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-modules", detail: "selected compiler route" }] });
  expect(factory.processes).not.toHaveBeenCalled();
  expect(explicit.spawn).toHaveBeenCalledTimes(1);
});

const skillSet: ProjectionSet = { scope: "selected-surfaces", target: assemblyTarget, units: [{ kind: "skill", key: "session-cost", projection: assemblySkill }], resources: assemblySkill.resources };
test.each([
  { family: "agents", create: createCoreAgentProductServices, projection: coreAgentSet, documents: [{ path: ".claude/agents/aidlc-note-agent.md", source: "Prepared agent", namespaceLiterals: [] }] },
  { family: "knowledge", create: createCoreKnowledgeProductServices, projection: coreKnowledgeSet, documents: [{ path: ".claude/knowledge/aidlc-shared/guide.md", source: "Rendered knowledge", namespaceLiterals: [] }] },
  { family: "skills", create: createCoreSkillProductServices, projection: skillSet, documents: [{ path: ".claude/skills/aidlc-session-cost/SKILL.md", source: "Native skill", namespaceLiterals: [] }] },
  { family: "sensors", create: createCoreSensorProductServices, projection: coreSensorSet, documents: [{ path: ".claude/sensors/aidlc-example.md", source: "Rendered sensor\n", namespaceLiterals: [] }] },
])("$family services route native documents to the configured compiler", ({ create, projection, documents }) => {
  const recorded = recordedProcesses();
  const commands = create({ processes: recorded.processes }).commands!;
  expect(commands({ sourceRoot, basis, context, projection })).toEqual(nativeRefusal);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(recorded.spawn.mock.calls[0]![0].input)).toEqual({ root: sourceRoot, binding: context, documents, exactReads: true });
  expect(recorded.spawn.mock.calls[0]![0].env["SECRET"]).toBeUndefined();
});

test("method services route both template and recovery-seed text through the configured compiler", () => {
  const recorded = recordedProcesses();
  const documents = [{ path: "aidlc/spaces/default/memory/org.md", source: "prepared" }, { path: ".claude/tools/data/memory-seed/org.md", source: "prepared" }];
  expect(createCoreMethodRuntimeServices({ processes: recorded.processes }).commands!({ sourceRoot, basis, context, documents })).toEqual(nativeRefusal);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(recorded.spawn.mock.calls[0]![0].input).documents).toEqual([{ path: "aidlc/spaces/default/memory/org.md", source: "prepared" }, { path: ".claude/tools/data/memory-seed/org.md", source: "prepared" }]);
});

test("before-host native documents preserve input text without spawning the native compiler", () => {
  const recorded = recordedProcesses();
  const beforeHostPreparation = createCoreAgentProductServices({ processes: recorded.processes }).commands!({ sourceRoot, basis, context: { ...context, preparationStage: "before-host" }, projection: coreAgentSet });
  expect(beforeHostPreparation).toEqual({ status: "ok", value: { projection: coreAgentSet, inputs: [] } });
  expect(recorded.spawn).not.toHaveBeenCalled();
});

test("guidance bindings retain configured native compilation after source selection", async () => {
  const recorded = recordedProcesses();
  const guidancePreparation = await createGuidanceBindingPreparer({ processes: recorded.processes, operations: guidanceOperations() }).prepare({ ...guidanceBindingRequest, sourceRoot, context });
  expect(guidancePreparation).toEqual(nativeRefusal);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(recorded.spawn.mock.calls[0]![0].input).documents).toEqual([{ path: ".claude/aidlc-common/conductor.md", source: "Craft\n" }, { path: ".claude/aidlc-common/protocols/stage-protocol.md", source: "Rendered\n" }]);
});

test("harness documents retain configured native compilation after compatibility preparation", async () => {
  const recorded = recordedProcesses();
  const entryPreparationOutcome = await createHarnessDocumentPreparer({ processes: recorded.processes, operations: createEntryPreparationOperations(), prose: createEntryProse() }).prepare({ ...entryPreparation, sourceRoot, context });
  expect(entryPreparationOutcome).toEqual(nativeRefusal);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(recorded.spawn.mock.calls[0]![0].input).documents).toEqual([
    { path: "harness/claude/skills/aidlc/SKILL.md", source: "Rendered main\n\nNative compatibility\n" },
    { path: "harness/claude/skills/aidlc/composer.md", source: "Rendered composer\n" },
    { path: "harness/claude/skills/aidlc/question-rendering.md", source: "Rendered question\n" },
    { path: "harness/claude/rules-aidlc.md", source: "Rendered method\n" },
  ]);
});

test.each([createCoreGuidanceProductServices, createHarnessDocumentProductServices])("document product service construction forwards the process capability", create => {
  const recorded = recordedProcesses();
  create({ processes: recorded.processes });
  expect(recorded.processes.mock.calls).toEqual([[]]);
  expect(recorded.spawn).not.toHaveBeenCalled();
});

test("stage runtime services route a real phase/slug document through the configured compiler", () => {
  const recorded = recordedProcesses();
  expect(createStageRuntimeServices({ processes: recorded.processes }).commands.prepare({ ...nativeStageRequest, sourceRoot })).toEqual(nativeRefusal);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(recorded.spawn.mock.calls[0]![0].input).documents).toEqual(nativeStageRequest.documents);
});

test.each([createNativeDocumentCommandPreparer, createNativeStageCommandPreparer])("explicit document operations take precedence and preserve strict stderr handling", create => {
  const factory = recordedProcesses();
  const explicit = recordedProcesses({ exitCode: 0, stdout: "not JSON", stderr: "compiler warning\n", error: null });
  const documentPreparation = create({ processes: factory.processes, operations: explicit.processes() }).prepare({ ...nativeStageRequest, sourceRoot });
  expect(documentPreparation).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "native-document-commands", detail: "source-owned native text process unavailable or reported diagnostics: compiler warning" }] });
  expect(factory.processes).not.toHaveBeenCalled();
  expect(explicit.spawn).toHaveBeenCalledTimes(1);
});

test("runner ordinary compilation accepts diagnostics while discovery refuses an incomplete requirement set", () => {
  const recorded = recordedProcesses({ exitCode: 0, stdout: '[{"key":"init","status":"ok"}]', stderr: "runner warning\n", error: null });
  const runner = createRunnerProcess({ processes: recorded.processes, binary: "selected-bun" });
  const request = { runtime: { root: sourceRoot, binding: context }, requests: [{ key: "init", request: { kind: "init" } as const }] };
  expect(runner.execute(request)).toEqual({ status: "ok", value: [{ key: "init", status: "ok" }] });
  expect(runner.execute({ ...request, intent: "discover" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "claude", detail: "native runner discovery reported diagnostics; no complete requirement set was accepted: runner warning" }] });
  expect(recorded.spawn).toHaveBeenCalledTimes(2);
  expect(JSON.parse(recorded.spawn.mock.calls[0]![0].input).intent).toBeUndefined();
  expect(JSON.parse(recorded.spawn.mock.calls[1]![0].input).intent).toBe("discover");
  expect(recorded.spawn.mock.calls[0]![0]).toMatchObject({ binary: "selected-bun", cwd: sourceRoot, timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
});

test("explicit runner operations bypass factory construction and retain malformed-JSON findings", () => {
  const factory = recordedProcesses();
  const explicit = recordedProcesses({ exitCode: 0, stdout: "not JSON", stderr: "", error: null });
  const operations = createRunnerProcessOperations({ processes: explicit.processes });
  expect(createRunnerProcess({ processes: factory.processes, operations }).execute({ runtime: { root: sourceRoot, binding: context }, requests: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "claude", detail: "runner compiler must return one JSON response without surrounding output" }] });
  expect(factory.processes).not.toHaveBeenCalled();
  expect(explicit.spawn).toHaveBeenCalledTimes(1);
});

test.each([
  { family: "opencode", binding: { harness: "opencode", directory: ".aidlc" }, subject: "opencode-settings", code: "foreign-content", timeout: 10000, factoryCalls: [[], []] },
  { family: "copilot", binding: { harness: "copilot", directory: ".aidlc" }, subject: "copilot-settings", code: "foreign-content", timeout: 10000, factoryCalls: [[], []] },
  { family: "kiro", binding: { harness: "kiro", directory: ".kiro" }, subject: "kiro-source-preparation", code: "capability-gap", timeout: 30000, factoryCalls: [[], [{ timeout: 30000 }]] },
  { family: "kiro-ide", binding: { harness: "kiro-ide", directory: ".kiro" }, subject: "kas-source-preparation", code: "capability-gap", timeout: 30000, factoryCalls: [[], [{ timeout: 30000 }]] },
] as const)("$family settings dispatch reaches the configured transport and retains diagnostics", async ({ binding, subject, code, timeout, factoryCalls }) => {
  const root = fixtures.create();
  const recorded = recordedProcesses({ exitCode: 0, stdout: "not JSON", stderr: "selected settings diagnostic", error: null });
  const settingsPreparation = await createSourceHarnessSettingsPreparer({ processes: recorded.processes, binary: "selected-bun", environmentCap: "balanced" }).prepare({ sourceRoot, root, basis, binding, invocation: "aidlc", mode: 0o644, files: [`${binding.directory}/tools/aidlc.ts`, `${binding.directory}/hooks/aidlc-copilot-adapter.ts`] });
  expect(settingsPreparation).toEqual({ status: "invalid", findings: [{ code, subject, detail: "selected settings diagnostic" }] });
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  const input = recorded.spawn.mock.calls[0]![0];
  expect(input).toMatchObject({ binary: "selected-bun", timeout, maxBuffer: 8 * 1024 * 1024 });
  expect(JSON.parse(input.input)).toMatchObject({ sourceRoot, invocation: "aidlc" });
  expect(runtimeDirectoryParent(input.cwd)).toBe(root);
  expect(runtimeDirectoryExists(input.cwd)).toBe(false);
  expect(input.env["SECRET"]).toBeUndefined();
  expect<readonly (readonly [limits?: NativeCompilerProcessLimits | undefined])[]>(recorded.processes.mock.calls).toEqual(factoryCalls);
});

test.each([{ harness: "kiro", subject: "kiro-source-preparation" }, { harness: "kiro-ide", subject: "kas-source-preparation" }] as const)("$harness agent services forward the factory into their specialized helper", ({ harness, subject }) => {
  const workRoot = fixtures.create();
  const recorded = recordedProcesses({ exitCode: 0, stdout: "not JSON", stderr: "selected agent diagnostic", error: null });
  const selection: ProjectionSetRequest = { target: { harness, directory: ".kiro" }, units: [{ kind: "compiled-agent", key: "agent-aidlc-note-agent", input: { agent: coreAgent, context: { ...coreAgentContext, harness, directory: ".kiro", invocation: "aidlc" }, catalogue: coreAgentCatalogue, footprint: "definition", knowledge: [{ origin: coreAgentKnowledgeOrigin, body: "Methodology" }] } }] };
  const agentPreparation = createCoreAgentProductServices({ processes: recorded.processes }).native!({ sourceRoot, workRoot, basis, selection });
  expect(agentPreparation).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject, detail: "selected agent diagnostic" }] });
  expect(recorded.processes.mock.calls).toEqual([[{ timeout: 30000 }]]);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  const input = recorded.spawn.mock.calls[0]![0];
  expect(input.timeout).toBe(30000);
  expect(JSON.parse(input.input)).toMatchObject({ sourceRoot, invocation: "aidlc" });
  expect(runtimeDirectoryParent(input.cwd)).toBe(workRoot);
  expect(runtimeDirectoryExists(input.cwd)).toBe(false);
});

test("workflow references route both table generation and final native text through the configured capability", async () => {
  const digest = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const requestBasis = { source: compiledWorkflow.compiler.source, pin: compiledWorkflow.compiler.pin };
  const authoringInputs = [{ path: "harness/claude/manifest.ts", sha256: digest }, { path: "scripts/manifest-types.ts", sha256: digest }];
  const scope = { kind: "file", path: ".claude/scopes/aidlc-example.md", body: "scope bytes" } as const;
  const request: WorkflowReferenceRequest = { sourceRoot, root: "private-runtime", basis: requestBasis, context, workflow: compiledWorkflow, authoring: { binding: context, optionLetters: null, inputs: authoringInputs, origins: [{ ...requestBasis, path: "harness/claude/manifest.ts" }, { ...requestBasis, path: "scripts/manifest-types.ts" }] }, scopeFiles: [scope] };
  const regions = [{ verb: "stage-table", begin: "<!--stage-->", end: "<!--/stage-->" }, { verb: "scope-table", begin: "<!--scope-->", end: "<!--/scope-->" }] as const;
  const recorded = recordedProcesses();
  recorded.spawn.mockReturnValueOnce({ exitCode: 0, stderr: "", error: null, stdout: "<!--stage-->`aidlc engine gen stage-table`\n<!--/stage-->" });
  recorded.spawn.mockReturnValueOnce({ exitCode: 0, stderr: "", error: null, stdout: "<!--scope-->`aidlc engine gen scope-table`\n<!--/scope-->" });
  const fileTexts = new Map([
    ["scripts/generated-skill-regions.ts", "reference bytes"],
    ["core/tools/aidlc-utility.ts", "reference bytes"],
    ["core/tools/aidlc-compiled-tables.ts", "reference bytes"],
    ["harness/claude/skills/aidlc/tables.md", "reference bytes"],
    ["scripts/native-runtime-text.ts", "reference bytes"],
    ["scripts/native-command-text.ts", "reference bytes"],
    ["scripts/native-command-context.ts", "reference bytes"],
    ["core/tools/aidlc-command.ts", "reference bytes"],
    ["core/tools/aidlc-routes.ts", "reference bytes"],
    ["core/tools/aidlc-color.ts", "reference bytes"],
    ["core/tools/aidlc-runtime-paths.ts", "reference bytes"],
    [".claude/tools/aidlc-utility.ts", "reference bytes"],
    [".claude/tools/aidlc-compiled-tables.ts", "reference bytes"],
    [compiledWorkflow.graph.origin.path, compiledWorkflow.graph.text],
    [compiledWorkflow.grid.origin.path, compiledWorkflow.grid.text],
    [scope.path, scope.body],
  ]);
  const sourceModules = new Map<string, unknown>([
    ["scripts/native-runtime-text.ts", { prepareNativeRuntimeText: (text: string) => text }],
    ["scripts/generated-skill-regions.ts", Object.fromEntries([
      ["GENERATED_SKILL_REGIONS", regions],
      ["replaceGeneratedSkillRegion", ({ text, rendered }: { readonly text: string; readonly rendered: string }) => ({ status: "ok", text: `${text}\n${rendered}` })],
    ])],
  ]);
  const operations = createWorkflowReferenceOperations({ processes: recorded.processes });
  const referencePreparation = await createWorkflowReferencePreparer({ processes: recorded.processes, operations: {
    ...operations,
    authoring: async () => ({ status: "ok", value: { capability: "declared", inputs: authoringInputs, manifest: { name: "claude", harnessDir: ".claude", orchestratorSkillPath: ".claude/skills/aidlc/SKILL.md", harnessFiles: [{ src: "skills/aidlc/tables.md", dst: "skills/aidlc/tables.md" }] } } }),
    read: async ({ path }) => ({ status: "ok", value: new TextEncoder().encode(fileTexts.get(path)!) }),
    scopes: async () => ({ status: "ok", value: [scope.path] }),
    module: async ({ path }) => ({ status: "ok", value: sourceModules.get(path) }),
    digest: () => digest,
  } }).prepare(request);
  expect(referencePreparation).toEqual(nativeRefusal);
  expect(recorded.processes.mock.calls).toEqual([[], []]);
  expect(recorded.spawn).toHaveBeenCalledTimes(3);
  expect(recorded.spawn.mock.calls[0]![0].args).toEqual(["--no-install", "private-runtime/.claude/tools/aidlc-utility.ts", "stage-table"]);
  expect(recorded.spawn.mock.calls[1]![0].args).toEqual(["--no-install", "private-runtime/.claude/tools/aidlc-utility.ts", "scope-table"]);
  expect(JSON.parse(recorded.spawn.mock.calls[2]![0].input).documents).toEqual([{ path: ".claude/skills/aidlc/tables.md", source: "reference bytes\n<!--stage-->`aidlc engine gen stage-table`\n<!--/stage-->\n<!--scope-->`aidlc engine gen scope-table`\n<!--/scope-->" }]);
});


test("agent policy reader forwards the configured factory and releases the private compiler root", async () => {
  const workRoot = fixtures.create();
  const recorded = recordedProcesses({ exitCode: 0, stdout: "not JSON", stderr: "selected policy diagnostic", error: null });
  const policyPreparation = await createCoreAgentPolicyReader({ workRoot, processes: recorded.processes, binary: "selected-bun" }).load({ sourceRoot, basis, binding: context, environmentCap: "balanced" });
  expect(policyPreparation).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail: "selected policy diagnostic" }] });
  expect(recorded.processes.mock.calls).toEqual([[]]);
  expect(recorded.spawn).toHaveBeenCalledTimes(1);
  const input = recorded.spawn.mock.calls[0]![0];
  expect(input).toMatchObject({ binary: "selected-bun", timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  expect(JSON.parse(input.input)).toMatchObject({ sourceRoot, harness: "claude", environmentCap: "balanced" });
  expect(runtimeDirectoryParent(input.cwd)).toBe(workRoot);
  expect(runtimeDirectoryExists(input.cwd)).toBe(false);
});

test("ordinary settings preserve explicit operations precedence and strict diagnostics", async () => {
  const factory = recordedProcesses();
  const explicit = recordedProcesses({ exitCode: 0, stdout: "not JSON", stderr: "settings warning", error: null });
  const explicitSettingsPreparation = await createSourceHarnessSettingsPreparer({ processes: factory.processes, operations: createSourceHarnessSettingsOperations({ processes: explicit.processes }) }).prepare({ sourceRoot, root: fixtures.create(), basis, binding: context, invocation: "aidlc", mode: 0o644, files: [".claude/tools/aidlc.ts"] });
  expect(explicitSettingsPreparation).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-harness-settings", detail: "harness settings process unavailable or reported diagnostics" }] });
  expect(factory.processes).not.toHaveBeenCalled();
  expect(explicit.spawn).toHaveBeenCalledTimes(1);
});
