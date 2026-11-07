// Native command preparation retains source witnesses and product provenance.
import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createNativeDocumentCommandPreparer, nativeDocumentCommandSourcePaths } from "../../scripts/projection/src/adapters/native-document-commands.ts";
import { createNativeStageCommandPreparer } from "../../scripts/projection/src/adapters/native-stage-commands.ts";
import { prepareDocumentCommands, prepareNativeProjectionCommands } from "../../scripts/projection/src/adapters/native-document-preparation.ts";
import { prepareProjectedProducts } from "../../scripts/projection/src/application/projected-products.ts";
import type { ProjectionSet } from "../../scripts/projection/src/application/projection-set.ts";
import { renderKnowledgeDefinition } from "../../scripts/projection/src/domain/knowledge-definition.ts";
import { renderSensorDefinition } from "../../scripts/projection/src/domain/sensor-definition.ts";
const sourceRoot = join(import.meta.dir, "../..");
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const binding = { harness: "claude", directory: ".claude" } as const;
const context = { ...binding, invocation: "aidlc", rulesSubdir: "rules" } as const;
const modules = nativeDocumentCommandSourcePaths();
const document = { path: ".claude/knowledge/aidlc-shared/example.md", source: "Run `bun .claude/tools/aidlc.ts gen stage-table`, then `bun .claude/tools/aidlc-utility.ts config-change --depth deep`." };
const request = { sourceRoot, basis, binding, documents: [document] };
test("source policy prepares dispatcher and delegate commands with every witness", () => {
  const result = createNativeDocumentCommandPreparer().prepare(request);
  if (result.status === "invalid") throw new Error(JSON.stringify(result.findings));
  expect(result.value.documents[0]?.text).toBe("Run `aidlc engine gen stage-table`, then `aidlc engine config set depth deep`.");
  expect(result.value.documents[0]?.source).toBe(document.source);
  expect(result.value.inputs.map(input => input.path)).toEqual([...modules]);
  expect(result.value.documents[0]?.origins.map(origin => origin.path)).toEqual([...modules]);
  expect(result.value.inputs.every(input => /^[a-f0-9]{64}$/.test(input.sha256))).toBe(true);
});
test.each(["{{INVOKE}} doctor", "aidlc engine does-not-exist", "bun .claude/hooks/aidlc-example.ts"])("unprepared command refuses: %s", source => {
  expect(createNativeDocumentCommandPreparer().prepare({ ...request, documents: [{ ...document, source }] }).status).toBe("invalid");
});
test.each([{ documents: [] }, { documents: [{ path: "../escape.md", source: "text" }] }, { documents: [document, document] }])("invalid document inventory refuses before source execution", ({ documents }) => {
  let calls = 0;
  const result = createNativeDocumentCommandPreparer({ operations: { environment: () => ({}), spawn: () => { calls++; throw new Error("unexpected execution"); } } }).prepare({ ...request, documents });
  expect(result.status).toBe("invalid"); expect(calls).toBe(0);
});
test("stage preparation retains its narrower path admission", () => {
  let calls = 0;
  const result = createNativeStageCommandPreparer({ operations: { environment: () => ({}), spawn: () => { calls++; throw new Error("unexpected execution"); } } }).prepare(request);
  expect(result.status).toBe("invalid"); expect(calls).toBe(0);
});
test("copy preparation does not invoke native policy or alter bytes", () => {
  const result = prepareDocumentCommands({ ...request, context: { ...context, invocation: "bun .claude/tools/aidlc.ts" }, preparer: { prepare: () => { throw new Error("unexpected native policy"); } } });
  if (result.status === "invalid") throw new Error(JSON.stringify(result.findings));
  expect(result.value.inputs).toEqual([]); expect(result.value.documents[0]?.text).toBe(document.source);
});
test("native projection units and products carry identical text and command provenance", () => {
  const resource = { kind: "file", path: document.path, body: document.source } as const;
  const origin = { ...basis, path: "core/knowledge/aidlc-shared/example.md" };
  const projection: ProjectionSet = { scope: "selected-surfaces", target: binding, units: [{ kind: "knowledge", key: "knowledge-example", projection: { origin, harness: "claude", resources: [resource] } }], resources: [resource] };
  const prepared = prepareNativeProjectionCommands({ sourceRoot, basis, context, projection });
  if (prepared.status === "invalid") throw new Error(JSON.stringify(prepared.findings));
  expect(prepared.value.projection.resources).toEqual(prepared.value.projection.units[0]?.projection.resources ?? []);
  const products = prepareProjectedProducts({ projection: prepared.value.projection, sources: [basis], compiler: basis, mode: 0o644, rules: { encode: ({ text }) => new TextEncoder().encode(text) } });
  if (products.status === "invalid") throw new Error(JSON.stringify(products.findings));
  expect(products.value[0]?.inputs.map(input => input.path)).toEqual([origin.path, ...modules]);
  expect(new TextDecoder().decode(products.value[0]?.files[0]?.bytes)).toBe(prepared.value.projection.resources[0]?.body ?? "");
});
test("existing knowledge and sensor renderers accept explicit native token context", () => {
  const origin = { ...basis, path: "core/knowledge/aidlc-shared/example.md" };
  const knowledge = renderKnowledgeDefinition({ context, document: { origin, relativePath: "aidlc-shared/example.md", text: "Use {{INVOKE}} doctor." } });
  const sensor = renderSensorDefinition({ context, document: { origin: { ...basis, path: "core/sensors/aidlc-example.md" }, fileName: "aidlc-example.md", text: "Use {{INVOKE}} doctor." } });
  for (const result of [knowledge, sensor]) { if (result.status === "invalid") throw new Error(JSON.stringify(result.findings)); expect(result.value.resources[0]?.body).toBe("Use aidlc doctor."); }
});
function isolatedSource(run: (root: string) => void): void {
  // Keep mutation fixtures under this checkout, not the host's temp drive.
  const root = mkdtempSync(join(sourceRoot, ".native-command-test-"));
  try { for (const path of modules) { mkdirSync(dirname(join(root, path)), { recursive: true }); cpSync(join(sourceRoot, path), join(root, path)); } run(root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
test("mutated source policy changes prepared bytes and its witness", () => isolatedSource(root => {
  const file = join(root, "scripts/native-command-text.ts");
  const before = createNativeDocumentCommandPreparer().prepare({ ...request, sourceRoot: root });
  writeFileSync(file, readFileSync(file, "utf8").replace("const text = projectNativeCommandText({ source, context });", 'const text = projectNativeCommandText({ source, context }) + " changed";'));
  const after = createNativeDocumentCommandPreparer().prepare({ ...request, sourceRoot: root });
  if (before.status === "invalid" || after.status === "invalid") throw new Error(JSON.stringify({ before, after }));
  expect(after.value.documents[0]?.text).toBe((before.value.documents[0]?.text ?? "") + " changed");
  expect(after.value.inputs[0]?.sha256).not.toBe(before.value.inputs[0]?.sha256);
}));
test("policy changes during preparation refuse the complete result", () => isolatedSource(root => {
  const file = join(root, "scripts/native-command-text.ts");
  writeFileSync(file, 'import { appendFileSync } from "node:fs";\n' + readFileSync(file, "utf8").replace("const text = projectNativeCommandText({ source, context });", 'appendFileSync(import.meta.path, "\\n"); const text = projectNativeCommandText({ source, context });'));
  const result = createNativeDocumentCommandPreparer().prepare({ ...request, sourceRoot: root });
  expect(result.status).toBe("invalid"); if (result.status === "invalid") expect(result.findings[0]?.detail).toContain("source changed");
}));
for (const change of ["path", "source", "missing-witness", "duplicate-witness"] as const) test(`native reply refuses ${change}`, () => {
  const inputs = modules.map(path => ({ path, sha256: "a".repeat(64) }));
  const returned = [{ ...document, text: "prepared" }];
  if (change === "path") returned[0]!.path = ".claude/knowledge/other.md";
  if (change === "source") returned[0]!.source = "different request";
  if (change === "missing-witness") inputs.pop();
  if (change === "duplicate-witness") inputs[1] = inputs[0]!;
  const result = createNativeDocumentCommandPreparer({ operations: { environment: () => ({}), spawn: () => ({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "ok", documents: returned, inputs }) }) } }).prepare(request);
  expect(result.status).toBe("invalid");
});

const copyCwdWarning = "**CWD drift warning**: If a stage runs `cd` in Bash, the copy tool path moves with the shell.\n";
const nativeCwdWarning = "**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.\n";
test("native guidance receives shared source-owned CWD prose before ownership", () => {
  const result = createNativeDocumentCommandPreparer().prepare({ ...request, documents: [{ path: ".claude/aidlc-common/protocols/stage-protocol.md", source: copyCwdWarning }] });
  if (result.status === "invalid") throw new Error(JSON.stringify(result.findings));
  expect(result.value.documents[0]?.text).toBe(nativeCwdWarning);
  expect(result.value.inputs.some(input => input.path === "scripts/native-runtime-text.ts")).toBe(true);
  expect(result.value.documents[0]?.origins.some(origin => origin.path === "scripts/native-runtime-text.ts")).toBe(true);
});
test("copy guidance retains its authored CWD warning", () => {
  const result = prepareDocumentCommands({ ...request, context: { ...context, invocation: "bun .claude/tools/aidlc.ts" }, documents: [{ path: ".claude/aidlc-common/protocols/stage-protocol.md", source: copyCwdWarning }] });
  if (result.status === "invalid") throw new Error(JSON.stringify(result.findings));
  expect(result.value.documents[0]?.text).toBe(copyCwdWarning);
  expect(result.value.inputs).toEqual([]);
});
test("shared prose policy changes are observed by the document preparer", () => isolatedSource(root => {
  const file = join(root, "scripts/native-runtime-text.ts");
  const candidate = { ...request, sourceRoot: root, documents: [{ path: ".claude/aidlc-common/protocols/stage-protocol.md", source: copyCwdWarning }] };
  const before = createNativeDocumentCommandPreparer().prepare(candidate);
  writeFileSync(file, readFileSync(file, "utf8").replace("Native release commands resolve", "Native commands resolve"));
  const after = createNativeDocumentCommandPreparer().prepare(candidate);
  if (before.status === "invalid" || after.status === "invalid") throw new Error(JSON.stringify({ before, after }));
  expect(after.value.documents[0]?.text).toBe(nativeCwdWarning.replace("Native release commands resolve", "Native commands resolve"));
  expect(after.value.inputs.find(input => input.path === "scripts/native-runtime-text.ts")?.sha256).not.toBe(before.value.inputs.find(input => input.path === "scripts/native-runtime-text.ts")?.sha256);
}));
