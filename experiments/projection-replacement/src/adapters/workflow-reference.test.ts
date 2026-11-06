import { expect, test } from "bun:test";
import { createWorkflowReferencePreparer } from "./workflow-reference.ts";
import { createWorkflowReferenceFixture, referenceRequest, referenceManifestSnapshot, referenceDigest, referenceFailure, stageReferenceRegion, scopeReferenceRegion, stageReferenceOutput, scopeReferenceOutput } from "../../__tests__/workflow-reference-fixtures.ts";
import type { Finding } from "../domain/model.ts";

test("prepares the owned tables file through the source helper and native generators", async () => {
  const fixture = createWorkflowReferenceFixture();
  expect(await createWorkflowReferencePreparer({ binary: "/bun", operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "ok", value: {
    file: { kind: "file", path: ".claude/skills/aidlc/tables.md", body: "source helper final" }, inputs: [
      { path: "harness/claude/manifest.ts", sha256: referenceDigest }, { path: "scripts/manifest-types.ts", sha256: referenceDigest },
      { path: "core/tools/aidlc-graph.ts", sha256: referenceDigest }, { path: "core/scopes/aidlc-classic.md", sha256: referenceDigest },
      { path: "scripts/generated-skill-regions.ts", sha256: referenceDigest }, { path: "core/tools/aidlc-utility.ts", sha256: referenceDigest },
      { path: "core/tools/aidlc-compiled-tables.ts", sha256: referenceDigest }, { path: "harness/claude/skills/aidlc/tables.md", sha256: referenceDigest },
    ],
  } });
  expect(fixture.operations.authoring.mock.calls).toEqual([[{ sourceRoot: "/source", basis: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" }, binding: referenceRequest.context }]]);
  expect(fixture.operations.module.mock.calls).toEqual([[{ sourceRoot: "/source", path: "scripts/generated-skill-regions.ts", sha256: referenceDigest }]]);
  expect(fixture.operations.prose.mock.calls).toEqual([[{ markdown: "# {{INVOKE}}\n", context: referenceRequest.context, subject: ".claude/skills/aidlc/tables.md" }]]);
  expect(fixture.replace.mock.calls).toEqual([
    [{ text: "projected template", rendered: stageReferenceOutput, region: stageReferenceRegion, path: ".claude/skills/aidlc/tables.md" }],
    [{ text: "stage intermediate", rendered: scopeReferenceOutput, region: scopeReferenceRegion, path: ".claude/skills/aidlc/tables.md" }],
  ]);
  expect(fixture.operations.process.spawn.mock.calls[0]).toEqual([{ binary: "/bun", args: ["--no-install", "/runtime/.claude/tools/aidlc-utility.ts", "stage-table"], cwd: "/runtime/.claude", input: "", env: {
    ["PATH"]: "/bin", ["HOME"]: "/runtime/.workflow-reference-home", ["USERPROFILE"]: "/runtime/.workflow-reference-home", ["APPDATA"]: "/runtime/.workflow-reference-home", ["LOCALAPPDATA"]: "/runtime/.workflow-reference-home", ["TEMP"]: "/runtime/.workflow-reference-home", ["TMP"]: "/runtime/.workflow-reference-home", ["BUN_TMPDIR"]: "/runtime/.workflow-reference-home", ["BUN_INSTALL"]: "/runtime/.workflow-reference-home/bun-install", ["BUN_INSTALL_CACHE_DIR"]: "/runtime/.workflow-reference-home/bun-cache", ["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]: "/runtime/.workflow-reference-home/transpiler-cache",
    ["AIDLC_SRC"]: "/runtime/.claude", ["AIDLC_HARNESS_DIR"]: ".claude", ["AIDLC_HARNESS_NAME"]: "claude", ["AIDLC_PROJECT_DIR"]: "/runtime", ["AIDLC_RUNTIME_PROJECT_DIR"]: "/runtime", ["AIDLC_RUNTIME_HARNESS_ROOT"]: "/runtime/.claude", ["AIDLC_STAGE_GRAPH"]: "/runtime/.claude/tools/data/stage-graph.json", ["AIDLC_SCOPE_GRID"]: "/runtime/.claude/tools/data/scope-grid.json", ["AIDLC_SCOPES_DIR"]: "/runtime/.claude/scopes",
  } }]);
  expect(fixture.operations.process.spawn.mock.calls[1]?.[0].args).toEqual(["--no-install", "/runtime/.claude/tools/aidlc-utility.ts", "scope-table"]);
  expect(fixture.operations.read.mock.calls).toEqual([
    [{ root: "/source", path: "scripts/generated-skill-regions.ts" }], [{ root: "/source", path: "core/tools/aidlc-utility.ts" }], [{ root: "/source", path: "core/tools/aidlc-compiled-tables.ts" }], [{ root: "/source", path: "harness/claude/skills/aidlc/tables.md" }],
    [{ root: "/runtime", path: ".claude/tools/aidlc-utility.ts" }], [{ root: "/runtime", path: ".claude/tools/aidlc-compiled-tables.ts" }], [{ root: "/runtime", path: ".claude/tools/data/stage-graph.json" }], [{ root: "/runtime", path: ".claude/tools/data/scope-grid.json" }], [{ root: "/runtime", path: ".claude/scopes/aidlc-classic.md" }],
    [{ root: "/source", path: "scripts/generated-skill-regions.ts" }], [{ root: "/source", path: "core/tools/aidlc-utility.ts" }], [{ root: "/source", path: "core/tools/aidlc-compiled-tables.ts" }], [{ root: "/source", path: "harness/claude/skills/aidlc/tables.md" }],
    [{ root: "/runtime", path: ".claude/tools/aidlc-utility.ts" }], [{ root: "/runtime", path: ".claude/tools/aidlc-compiled-tables.ts" }], [{ root: "/runtime", path: ".claude/tools/data/stage-graph.json" }], [{ root: "/runtime", path: ".claude/tools/data/scope-grid.json" }], [{ root: "/runtime", path: ".claude/scopes/aidlc-classic.md" }],
  ]);
  expect(fixture.operations.scopes.mock.calls).toEqual([[{ root: "/runtime", directory: ".claude/scopes" }], [{ root: "/runtime", directory: ".claude/scopes" }]]);
  expect(fixture.operations.digest.mock.calls).toEqual([
    [{ bytes: new Uint8Array([104]) }], [{ bytes: new Uint8Array([117]) }], [{ bytes: new Uint8Array([102]) }],
    [{ bytes: new Uint8Array([35, 32, 123, 123, 73, 78, 86, 79, 75, 69, 125, 125, 13, 10]) }],
  ]);
});

test("foreign compiled provenance refuses before observing native inputs", async () => {
  const fixture = createWorkflowReferenceFixture();
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare({ ...referenceRequest, workflow: { ...referenceRequest.workflow, graph: { ...referenceRequest.workflow.graph, origin: { ...referenceRequest.workflow.graph.origin, pin: "2222222222222222222222222222222222222222" } } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-reference", detail: "compiled workflow graph, grid and compiler witnesses must share the requested source basis and binding" }] });
  expect(fixture.operations.authoring).not.toHaveBeenCalled();
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test("an unqualified copy invocation cannot acquire generated reference authority", async () => {
  const fixture = createWorkflowReferenceFixture();
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare({ ...referenceRequest, context: { ...referenceRequest.context, invocation: "aidlc" } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "workflow-reference", detail: "compiled workflow references currently qualify the Claude Bun copy profile" }] });
  expect(fixture.operations.authoring).not.toHaveBeenCalled();
});

test.each([
  { manifest: { ...referenceManifestSnapshot.manifest, orchestratorSkillPath: ".claude/../skills/aidlc/SKILL.md", harnessFiles: [{ src: "skills/aidlc/tables.md", dst: "../skills/aidlc/tables.md" }] }, inputs: referenceManifestSnapshot.inputs, detail: "native orchestrator skill must belong to the requested Claude harness" },
  { manifest: { ...referenceManifestSnapshot.manifest, harnessFiles: [] }, inputs: referenceManifestSnapshot.inputs, detail: "reference template mapping and manifest witnesses must match the prepared authoring policy" },
  { manifest: referenceManifestSnapshot.manifest, inputs: [{ path: "harness/claude/manifest.ts", sha256: referenceDigest }, { path: "harness/claude/manifest.ts", sha256: referenceDigest }], detail: "reference template mapping and manifest witnesses must match the prepared authoring policy" },
])("refuses unsafe or inconsistent native mapping facts: $detail", async ({ manifest, inputs, detail }) => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.authoring.mockResolvedValue({ status: "ok", value: { capability: "declared", manifest, inputs } });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-reference", detail }] });
  expect(fixture.operations.read).not.toHaveBeenCalled();
});

test("source snapshot operational refusal propagates before mapping admission", async () => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.authoring.mockResolvedValue(referenceFailure);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual(referenceFailure);
  expect(fixture.operations.read).not.toHaveBeenCalled();
});

test("file observation refusal propagates before scope inventory and generation", async () => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.read.mockReset().mockResolvedValue(referenceFailure);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "fixture", detail: "fixture unavailable" }] });
  expect(fixture.operations.scopes).not.toHaveBeenCalled();
  expect(fixture.operations.module).not.toHaveBeenCalled();
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test("scope inventory refusal propagates before module loading and generation", async () => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.scopes.mockResolvedValue(referenceFailure);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "fixture", detail: "fixture unavailable" }] });
  expect(fixture.operations.module).not.toHaveBeenCalled();
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test.each([
  { runtimeUtility: new Uint8Array([99]), detail: "runtime utility and compiled-table formatter must match their source-owned bytes" },
  { runtimeGraph: new Uint8Array([99]), detail: "private runtime graph and grid must be the supplied fresh workflow compilation" },
  { runtimeGrid: new Uint8Array([99]), detail: "private runtime graph and grid must be the supplied fresh workflow compilation" },
  { runtimeScope: new Uint8Array([99]), detail: "private runtime scope inventory and bytes must match the caller's fresh scope projection" },
])("refuses stale source/runtime binding facts: $detail", async ({ detail, ...changes }) => {
  const fixture = createWorkflowReferenceFixture(changes);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-reference", detail }] });
  expect(fixture.operations.module).not.toHaveBeenCalled();
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test.each([
  { inventory: [".claude/scopes/aidlc-classic.md", ".claude/scopes/foreign.md"] },
  { inventory: [".claude/scopes/aidlc-classic.md", ".claude/scopes/aidlc-classic.md"] },
  { inventory: [] },
])("unknown, duplicate or missing runtime scope entries refuse: %s", async ({ inventory }) => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.scopes.mockResolvedValue({ status: "ok", value: inventory });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-reference", detail: "private runtime scope inventory and bytes must match the caller's fresh scope projection" }] });
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test("the helper module must expose its own supported source API", async () => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.module.mockResolvedValue({ status: "ok", value: {} });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-reference", detail: "source helper must expose stage-then-scope regions and the region replacement capability" }] });
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test("inherited helper exports cannot bypass the module boundary", async () => {
  const fixture = createWorkflowReferenceFixture();
  const namespace: unknown = Object.create({ ["GENERATED_SKILL_REGIONS"]: [stageReferenceRegion, scopeReferenceRegion], replaceGeneratedSkillRegion: fixture.replace });
  fixture.operations.module.mockResolvedValue({ status: "ok", value: namespace });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-reference", detail: "source helper must expose stage-then-scope regions and the region replacement capability" }] });
  expect(fixture.operations.prose).not.toHaveBeenCalled();
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test("an intentional source-helper no-op remains valid without an invented rewrite requirement", async () => {
  const fixture = createWorkflowReferenceFixture();
  fixture.replace.mockReset().mockReturnValue({ status: "ok", text: "projected template" });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "ok", value: {
    file: { kind: "file", path: ".claude/skills/aidlc/tables.md", body: "projected template" }, inputs: [
      { path: "harness/claude/manifest.ts", sha256: referenceDigest }, { path: "scripts/manifest-types.ts", sha256: referenceDigest },
      { path: "core/tools/aidlc-graph.ts", sha256: referenceDigest }, { path: "core/scopes/aidlc-classic.md", sha256: referenceDigest },
      { path: "scripts/generated-skill-regions.ts", sha256: referenceDigest }, { path: "core/tools/aidlc-utility.ts", sha256: referenceDigest },
      { path: "core/tools/aidlc-compiled-tables.ts", sha256: referenceDigest }, { path: "harness/claude/skills/aidlc/tables.md", sha256: referenceDigest },
    ],
  } });
  expect(fixture.operations.process.spawn).toHaveBeenCalledTimes(2);
});

test("module operational failure data stays distinct from invalid module exports", async () => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.module.mockResolvedValue(referenceFailure);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual(referenceFailure);
  expect(fixture.operations.prose).not.toHaveBeenCalled();
});

test("process capability failure becomes bounded data before helper invocation", async () => {
  const fixture = createWorkflowReferenceFixture();
  const process = Proxy.revocable(fixture.operations.process.spawn, {});
  process.revoke();
  expect(await createWorkflowReferencePreparer({ operations: { ...fixture.operations, process: { ...fixture.operations.process, spawn: process.proxy } } }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-reference", detail: "native stage-table process capability unavailable" }] });
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
  expect(fixture.replace).not.toHaveBeenCalled();
});

test("helper invocation failure becomes bounded data before scope generation", async () => {
  const fixture = createWorkflowReferenceFixture();
  const helper = Proxy.revocable(fixture.replace, {});
  helper.revoke();
  fixture.operations.module.mockResolvedValue({ status: "ok", value: { ["GENERATED_SKILL_REGIONS"]: [stageReferenceRegion, scopeReferenceRegion], replaceGeneratedSkillRegion: helper.proxy } });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-reference", detail: "source-owned region replacement capability unavailable" }] });
  expect(fixture.operations.process.spawn).toHaveBeenCalledTimes(1);
  expect(fixture.replace).not.toHaveBeenCalled();
});

test("strict UTF-8 refusal precedes prose and generation", async () => {
  const fixture = createWorkflowReferenceFixture({ template: new Uint8Array([255]) });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-reference", detail: "authored workflow reference template must contain strict UTF-8" }] });
  expect(fixture.operations.prose).not.toHaveBeenCalled();
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test("prose refusal does not invoke the native generator", async () => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.prose.mockReturnValue(referenceFailure);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual(referenceFailure);
  expect(fixture.operations.process.spawn).not.toHaveBeenCalled();
});

test.each([
  { reply: { exitCode: 1, stdout: "", stderr: "private", error: null }, expected: { code: "capability-gap", subject: "workflow-reference", detail: "native stage-table generation unavailable or reported diagnostics" } },
  { reply: { exitCode: 0, stdout: stageReferenceOutput, stderr: "warning", error: null }, expected: { code: "capability-gap", subject: "workflow-reference", detail: "native stage-table generation unavailable or reported diagnostics" } },
  { reply: { exitCode: null, stdout: "", stderr: "", error: "timeout" }, expected: { code: "capability-gap", subject: "workflow-reference", detail: "native stage-table generation unavailable or reported diagnostics" } },
  { reply: { exitCode: 0, stdout: "wrong invocation", stderr: "", error: null }, expected: { code: "invalid-input", subject: "workflow-reference", detail: "native stage-table output must contain its canonical copy invocation and complete region" } },
] satisfies readonly { readonly reply: { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string; readonly error: string | null }; readonly expected: Finding }[])("native generator refusal preserves first failure: $expected.detail", async ({ reply, expected }) => {
  const fixture = createWorkflowReferenceFixture();
  fixture.operations.process.spawn.mockReset().mockReturnValue(reply);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [expected] });
  expect(fixture.operations.process.spawn).toHaveBeenCalledTimes(1);
  expect(fixture.replace).not.toHaveBeenCalled();
});

test.each([
  { reply: { status: "refused", detail: "fixture malformed region" }, detail: "fixture malformed region" },
  { reply: { status: "ok", text: 3 }, detail: "source-owned region helper returned an unsupported result" },
])("source helper refusal stops before scope generation: $detail", async ({ reply, detail }) => {
  const fixture = createWorkflowReferenceFixture();
  fixture.replace.mockReset().mockReturnValue(reply);
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-reference", detail }] });
  expect(fixture.operations.process.spawn).toHaveBeenCalledTimes(1);
});

test("observed source change refuses an otherwise successful pair of generations", async () => {
  const fixture = createWorkflowReferenceFixture({ afterHelper: new Uint8Array([99]) });
  expect(await createWorkflowReferencePreparer({ operations: fixture.operations }).prepare(referenceRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-reference", detail: "workflow reference inputs changed during generation; retry from stable source and private runtime inputs" }] });
  expect(fixture.operations.process.spawn).toHaveBeenCalledTimes(2);
});
