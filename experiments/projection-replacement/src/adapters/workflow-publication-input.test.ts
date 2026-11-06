import { expect, mock, test } from "bun:test";
import { parseWorkflowPublicationRequest, createWorkflowPublicationReader } from "./workflow-publication-input.ts";
import { workflowBuildRequest, workflowBuildJson } from "../../__tests__/workflow-publication-fixtures.ts";
test.each([{ harnessSettings: "native-supplied" }, { harnessSettings: "prepare-source" }] as const)("harness settings preserve the explicit source strategy", ({ harnessSettings }) => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, harnessSettings }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, harnessSettings } });
});
test("unknown settings strategy cannot silently retain native settings", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, harnessSettings: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test.each([
  { binding: { harness: "claude", directory: ".claude" }, runtimeModules: "native-supplied" },
  { binding: { harness: "cursor", directory: ".cursor" }, runtimeModules: "prepare-source" },
] as const)("reader refuses unsupported source settings profiles before producing anything", async (profile) => {
  const read = mock().mockResolvedValue(JSON.stringify({ ...workflowBuildRequest, ...profile, harnessSettings: "prepare-source" }));
  expect(await createWorkflowPublicationReader({ read, command: "build:core" }).load({ argv: ["request.json"] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-publication", detail: "source harness settings require Claude .claude with source-prepared runtime modules" }] });
});
test("settings source supports workflow profile without inventing core-only metadata", async () => {
  const request = { ...workflowBuildRequest, harnessSettings: "prepare-source", runtimeModules: "prepare-source" } as const;
  expect(await createWorkflowPublicationReader({ read: mock().mockResolvedValue(JSON.stringify(request)) }).load({ argv: ["request.json"] })).toEqual({ status: "ok", value: request });
});
test("initial source production defaults to authored stages and prepared method runtime", () => {
  expect(parseWorkflowPublicationRequest({ text: workflowBuildJson })).toEqual({ status: "ok", value: workflowBuildRequest });
});
test("runtime modules default to supplied without a caller strategy", () => {
  expect(parseWorkflowPublicationRequest({ text: '{"sourceRoot":"source","runtimeRoot":"runtime","sourcePin":"d062c81e5678c9f92162542b425b8a5f095e46e1","publicationPath":"artifact.sqlite","binding":{"harness":"claude","directory":".claude"},"mode":420}' })).toEqual({ status: "ok", value: workflowBuildRequest });
});

test.each([{ workspaceSeed: "native-supplied" }, { workspaceSeed: "prepare-source" }] as const)("workspace seed keeps an explicit requested strategy", ({ workspaceSeed }) => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, workspaceSeed }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, workspaceSeed } });
});

test("unknown workspace seed strategy cannot silently retain supplied bytes", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, workspaceSeed: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("directory construction requires an explicit strategy and independent mode", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, directories: { kind: "file-parents", mode: 0o755 } }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, directories: { kind: "file-parents", mode: 0o755 } } });
});
test.each([
  { kind: "file-parents" },
  { kind: "file-parents", mode: -1 },
  { kind: "file-parents", mode: 0o1000 },
  { kind: "guess", mode: 0o755 },
  { kind: "file-parents", mode: 0o755, inferFromFiles: true },
])("unsupported directory choices cannot infer or silently replace metadata", (directories) => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, directories }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("authored runtime modules require an explicit source strategy", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, runtimeModules: "prepare-source" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, runtimeModules: "prepare-source" } });
});
test("plugin authoring preparation is an explicit source strategy", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, pluginAuthoring: "prepare-source" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, pluginAuthoring: "prepare-source" } });
});
test("unknown plugin authoring preparation cannot silently reuse retained data", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, pluginAuthoring: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("unknown module strategies refuse rather than silently retaining supplied bytes", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, runtimeModules: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test.each([
  { harness: "claude", directory: ".claude" },
  { harness: "cursor", directory: ".cursor" },
  { harness: "codex", directory: ".codex" },
  { harness: "copilot", directory: ".aidlc" },
  { harness: "opencode", directory: ".aidlc" },
  { harness: "kiro", directory: ".kiro" },
  { harness: "kiro-ide", directory: ".kiro" },
])("source context is explicit and retains each exact harness binding: %s", (binding) => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, binding, runtimeContext: "prepare-source" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, binding, runtimeContext: "prepare-source" } });
});
test("unknown context strategies are refused at the request boundary", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, runtimeContext: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("authored runtime assets are an explicit strategy", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, runtimeAssets: "prepare-authored" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, runtimeAssets: "prepare-authored" } });
});
test("generated runtime contracts require an explicit source strategy", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, runtimeContracts: "prepare-source" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, runtimeContracts: "prepare-source" } });
});
test("unknown contract strategies cannot silently use retained products", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, runtimeContracts: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("unknown asset strategies cannot silently bypass input preparation", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, runtimeAssets: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("supplied method runtime requires an explicit caller choice", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, methodRuntime: "native-supplied" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, methodRuntime: "native-supplied" } });
});
test("unknown method strategies cannot silently bypass preparation", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, methodRuntime: "skip" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("malformed request JSON stays a distinct failure", () => {
  expect(parseWorkflowPublicationRequest({ text: "{" })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "workflow-publication", detail: "request must contain valid JSON" }] });
});
test("callers cannot supply a writable compiler context or override ownership", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, contextRoot: "user-project" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("a harness cannot bypass the exact directory binding", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, binding: { harness: "kiro-ide", directory: ".claude" } }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
test("one request file is loaded through the injected read port", async () => {
  expect(await createWorkflowPublicationReader({ read: mock().mockResolvedValue(workflowBuildJson) }).load({ argv: ["request.json"] })).toEqual({ status: "ok", value: workflowBuildRequest });
});
test("native supplied stages require an explicit caller choice", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, stageDocuments: "native-supplied" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, stageDocuments: "native-supplied" } });
});
test("an unavailable request is reported without publishing", async () => {
  expect(await createWorkflowPublicationReader({ read: mock().mockRejectedValue(new Error("absent")) }).load({ argv: ["missing.json"] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "missing.json", detail: "request unavailable: absent" }] });
});
test("extra command arguments stop before reading a request", async () => {
  const read = mock();
  expect(await createWorkflowPublicationReader({ read }).load({ argv: ["request.json", "override"] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "usage: npm run build:workflow -- <request.json>; publishes an initial native archive/ownership pair to an empty store" }] });
  expect(read).not.toHaveBeenCalled();
});

test("Core invocation guidance is explicit before request IO", async () => {
  const read = mock();
  expect(await createWorkflowPublicationReader({ read, command: "build:core" }).load({ argv: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "usage: npm run build:core -- <request.json>; publishes an initial native archive/ownership pair to an empty store" }] });
  expect(read).not.toHaveBeenCalled();
});

test("compiled reference preparation is an explicit parsed strategy", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, workflowReferences: "prepare-compiled" }) })).toEqual({ status: "ok", value: { ...workflowBuildRequest, workflowReferences: "prepare-compiled" } });
});
test("Core metadata is an explicit strategy with source version and directory prerequisites", async () => {
  const request = { ...workflowBuildRequest, distributionMetadata: "prepare-source", runtimeModules: "prepare-source", directories: { kind: "file-parents", mode: 0o755 } } as const;
  expect(await createWorkflowPublicationReader({ command: "build:core", read: mock().mockResolvedValue(JSON.stringify(request)) }).load({ argv: ["request.json"] })).toEqual({ status: "ok", value: request });
});
test.each([
  { command: "build:workflow", request: { ...workflowBuildRequest, distributionMetadata: "prepare-source", runtimeModules: "prepare-source", directories: { kind: "file-parents", mode: 0o755 } } },
  { command: "build:core", request: { ...workflowBuildRequest, distributionMetadata: "prepare-source", runtimeModules: "prepare-source" } },
  { command: "build:core", request: { ...workflowBuildRequest, distributionMetadata: "prepare-source", directories: { kind: "file-parents", mode: 0o755 } } },
] as const)("unsupported metadata publication contexts refuse before assembly", async ({ command, request }) => {
  expect(await createWorkflowPublicationReader({ command, read: mock().mockResolvedValue(JSON.stringify(request)) }).load({ argv: ["request.json"] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-publication", detail: "source distribution metadata requires build:core with source-prepared runtime modules and file-parent directories" }] });
});
test("unknown reference strategies cannot silently retain old tables", () => {
  expect(parseWorkflowPublicationRequest({ text: JSON.stringify({ ...workflowBuildRequest, workflowReferences: "guess" }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-publication", detail: "request requires trusted sourceRoot, runtimeRoot, full sourcePin, exact binding, persistent publicationPath, file mode 0..0777 and optional stageDocuments/methodRuntime/workflowReferences/runtimeContext/runtimeAssets/runtimeContracts/runtimeModules/pluginAuthoring/directories/distributionMetadata/workspaceSeed/harnessSettings; unexpected fields are refused" }] });
});
