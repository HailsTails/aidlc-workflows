import { mock, type Mock } from "bun:test";
import type { WorkflowReferenceOperations } from "../src/adapters/workflow-reference.ts";
import type { WorkflowReferenceRequest } from "../src/domain/workflow-reference.ts";
import type { Outcome } from "../src/domain/model.ts";

export const referenceDigest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const basis = { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" } satisfies WorkflowReferenceRequest["basis"];
export const referenceRequest: WorkflowReferenceRequest = {
  sourceRoot: "/source", root: "/runtime", basis,
  context: { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", optionLetters: "A-E" },
  workflow: { binding: { harness: "claude", directory: ".claude" }, compiler: { ...basis, path: "core/tools/aidlc-graph.ts" }, graph: { origin: { ...basis, path: ".claude/tools/data/stage-graph.json" }, text: "graph" }, grid: { origin: { ...basis, path: ".claude/tools/data/scope-grid.json" }, text: "grid" }, inputs: [{ path: "core/tools/aidlc-graph.ts", sha256: referenceDigest }, { path: "core/scopes/aidlc-classic.md", sha256: referenceDigest }] },
  authoring: { binding: { harness: "claude", directory: ".claude" }, optionLetters: "A-E", origins: [{ ...basis, path: "harness/claude/manifest.ts" }, { ...basis, path: "scripts/manifest-types.ts" }], inputs: [{ path: "harness/claude/manifest.ts", sha256: referenceDigest }, { path: "scripts/manifest-types.ts", sha256: referenceDigest }] },
  scopeFiles: [{ kind: "file", path: ".claude/scopes/aidlc-classic.md", body: "scope" }],
};
export const referenceManifestSnapshot = { capability: "declared", manifest: { name: "claude", harnessDir: ".claude", orchestratorSkillPath: ".claude/skills/aidlc/SKILL.md", harnessFiles: [{ src: "skills/aidlc/tables.md", dst: "skills/aidlc/tables.md" }] }, inputs: referenceRequest.authoring.inputs };
export const stageReferenceRegion = { verb: "stage-table", begin: "<!-- BEGIN: compiled stage graph via ", end: "<!-- END: compiled stage graph -->" };
export const scopeReferenceRegion = { verb: "scope-table", begin: "<!-- BEGIN: compiled scope grid via ", end: "<!-- END: compiled scope grid -->" };
export const stageReferenceOutput = "<!-- BEGIN: compiled stage graph via `bun .claude/tools/aidlc.ts engine gen stage-table` -->\nSTAGE TABLE\n<!-- END: compiled stage graph -->";
export const scopeReferenceOutput = "<!-- BEGIN: compiled scope grid via `bun .claude/tools/aidlc.ts engine gen scope-table` -->\nSCOPE TABLE\n<!-- END: compiled scope grid -->";
const helperBytes = new Uint8Array([104]);
const utilityBytes = new Uint8Array([117]);
const formatterBytes = new Uint8Array([102]);
const templateBytes = new TextEncoder().encode("# {{INVOKE}}\r\n");
const graphBytes = new TextEncoder().encode("graph");
const gridBytes = new TextEncoder().encode("grid");
const scopeBytes = new TextEncoder().encode("scope");
export type WorkflowReferenceFixture = {
  readonly replace: Mock<(input: unknown) => unknown>;
  readonly operations: { readonly [Key in Exclude<keyof WorkflowReferenceOperations, "process">]: Mock<WorkflowReferenceOperations[Key]> } & { readonly process: { readonly environment: Mock<WorkflowReferenceOperations["process"]["environment"]>; readonly spawn: Mock<WorkflowReferenceOperations["process"]["spawn"]> } };
};
export const createWorkflowReferenceFixture = ({ runtimeUtility = utilityBytes, runtimeGraph = graphBytes, runtimeGrid = gridBytes, runtimeScope = scopeBytes, template = templateBytes, afterHelper = helperBytes }: {
  readonly runtimeUtility?: Uint8Array; readonly runtimeGraph?: Uint8Array; readonly runtimeGrid?: Uint8Array; readonly runtimeScope?: Uint8Array; readonly template?: Uint8Array; readonly afterHelper?: Uint8Array;
} = {}): WorkflowReferenceFixture => {
  const replace = mock<(input: unknown) => unknown>().mockReturnValueOnce({ status: "ok", text: "stage intermediate" }).mockReturnValue({ status: "ok", text: "source helper final" });
  const read = mock<WorkflowReferenceOperations["read"]>()
    .mockResolvedValueOnce({ status: "ok", value: helperBytes }).mockResolvedValueOnce({ status: "ok", value: utilityBytes }).mockResolvedValueOnce({ status: "ok", value: formatterBytes }).mockResolvedValueOnce({ status: "ok", value: template })
    .mockResolvedValueOnce({ status: "ok", value: runtimeUtility }).mockResolvedValueOnce({ status: "ok", value: formatterBytes }).mockResolvedValueOnce({ status: "ok", value: runtimeGraph }).mockResolvedValueOnce({ status: "ok", value: runtimeGrid }).mockResolvedValueOnce({ status: "ok", value: runtimeScope })
    .mockResolvedValueOnce({ status: "ok", value: afterHelper }).mockResolvedValueOnce({ status: "ok", value: utilityBytes }).mockResolvedValueOnce({ status: "ok", value: formatterBytes }).mockResolvedValueOnce({ status: "ok", value: template })
    .mockResolvedValueOnce({ status: "ok", value: runtimeUtility }).mockResolvedValueOnce({ status: "ok", value: formatterBytes }).mockResolvedValueOnce({ status: "ok", value: runtimeGraph }).mockResolvedValueOnce({ status: "ok", value: runtimeGrid }).mockResolvedValueOnce({ status: "ok", value: runtimeScope });
  const operations = {
    authoring: mock<WorkflowReferenceOperations["authoring"]>().mockResolvedValue({ status: "ok", value: referenceManifestSnapshot }), read,
    scopes: mock<WorkflowReferenceOperations["scopes"]>().mockResolvedValue({ status: "ok", value: [".claude/scopes/aidlc-classic.md"] }),
    module: mock<WorkflowReferenceOperations["module"]>().mockResolvedValue({ status: "ok", value: { ["GENERATED_SKILL_REGIONS"]: [stageReferenceRegion, scopeReferenceRegion], replaceGeneratedSkillRegion: replace } }),
    digest: mock<WorkflowReferenceOperations["digest"]>().mockReturnValue(referenceDigest),
    prose: mock<WorkflowReferenceOperations["prose"]>().mockReturnValue({ status: "ok", value: "projected template" }),
    process: { environment: mock<WorkflowReferenceOperations["process"]["environment"]>().mockReturnValue(Object.fromEntries([["PATH", "/bin"], ["API_KEY", "private"], ["AIDLC_SRC", "foreign"]])), spawn: mock<WorkflowReferenceOperations["process"]["spawn"]>().mockReturnValueOnce({ exitCode: 0, stdout: stageReferenceOutput + "\n\n", stderr: "", error: null }).mockReturnValue({ exitCode: 0, stdout: scopeReferenceOutput + "\n", stderr: "", error: null }) },
  };
  return { operations, replace };
};
export const referenceFailure: Outcome<never> = { status: "invalid", findings: [{ code: "capability-gap", subject: "fixture", detail: "fixture unavailable" }] };
