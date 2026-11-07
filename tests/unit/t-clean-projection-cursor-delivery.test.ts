// covers: file:scripts/projection/src/adapters/qualified-delivery-policy.ts, file:scripts/projection/src/adapters/source-distribution-description.ts
import { expect, mock, test } from "bun:test";
import cursor from "../../harness/cursor/manifest.ts";
import type { HarnessManifest } from "../../scripts/manifest-types.ts";
import { qualifyDeliveryDeclaration, prepareDeliveryDeclaration, prepareQualifiedNativeDocument } from "../../scripts/projection/src/adapters/qualified-delivery-policy.ts";
import { qualifiedHarnessProfile, qualifiedDescriptionPaths } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { createSourceDescriptionPreparer } from "../../scripts/projection/src/adapters/source-distribution-description.ts";
import type { DistributionDescriptionRequest, PairedCopyDescription } from "../../scripts/projection/src/domain/distribution-description.ts";

const binding = { harness: "cursor", directory: ".cursor" } as const;
const qualified = qualifiedHarnessProfile(binding)!;
const clone = (): HarnessManifest => ({ ...cursor, harnessFiles: cursor.harnessFiles.map(file => ({ ...file })), rootIntegrations: cursor.rootIntegrations.map(integration => ({ ...integration })), nativeReplacements: cursor.nativeReplacements!.map(replacement => ({ ...replacement })) });

test("Cursor resources have explicit delivery and root ownership, independent of invocation policy", () => {
  expect(qualified.modelInvocation).toBe("native-default");
  expect(qualified.agentMemoryReference).toBe("aidlc/active-memory");
  expect(() => qualifyDeliveryDeclaration(cursor, qualified)).not.toThrow();
  expect(qualifiedDescriptionPaths(binding, "bun .cursor/tools/aidlc.ts")).toContain("install.ts");
  expect(qualifiedDescriptionPaths(binding, "aidlc")).not.toContain("install.ts");
  expect(prepareDeliveryDeclaration(cursor, qualified, "copy")).toBe(cursor);
  expect(prepareDeliveryDeclaration(cursor, qualified, "native").rootIntegrations.map(root => root.path)).toEqual([".gitignore", "AGENTS.md"]);
  expect(cursor.rootIntegrations.map(root => root.path)).toContain("install.ts");
});

const changes: Record<string, (manifest: HarnessManifest) => void> = {
  "other host": manifest => { manifest.name = "claude"; },
  "other directory": manifest => { manifest.harnessDir = ".foreign"; },
  "missing resource": manifest => { manifest.harnessFiles = manifest.harnessFiles.filter(file => !file.copyOnly); },
  "duplicate resource": manifest => { manifest.harnessFiles.push({ ...manifest.harnessFiles.find(file => file.copyOnly)! }); },
  "redirected source": manifest => { manifest.harnessFiles.find(file => file.copyOnly)!.src = "other.ts"; },
  "redirected destination": manifest => { manifest.harnessFiles.find(file => file.copyOnly)!.dst = "other.ts"; },
  "non-root resource": manifest => { manifest.harnessFiles.find(file => file.copyOnly)!.projectRoot = false; },
  "ordinary copy-only flag": manifest => { manifest.harnessFiles[0]!.copyOnly = true; },
  "wrong root owner": manifest => { manifest.rootIntegrations = manifest.rootIntegrations.map(root => root.path === "install.ts" ? { path: root.path, policy: "managed-block", marker: "installer" } : root); },
  "native root declaration": manifest => { manifest.nativeRootIntegrations = []; },
  "missing replacement": manifest => { delete manifest.nativeReplacements; },
  "extra replacement": manifest => { manifest.nativeReplacements!.push({ from: "extra", to: "native" }); },
  "empty replacement": manifest => { manifest.nativeReplacements![0]!.from = ""; },
};
for (const [name, change] of Object.entries(changes)) test(`delivery refuses ${name}`, () => {
  const declaration = clone(); change(declaration);
  expect(() => qualifyDeliveryDeclaration(declaration, qualified)).toThrow();
});

test("native replacement is source-owned, targeted, unique and before issuance", () => {
  const declaration = clone();
  const path = "harness/cursor/rules-aidlc.mdc";
  const from = declaration.nativeReplacements![0]!.from;
  expect(prepareQualifiedNativeDocument({ declaration, profile: qualified, path, text: `before ${from} after` })).toBe(`before ${declaration.nativeReplacements![0]!.to} after`);
  expect(prepareQualifiedNativeDocument({ declaration, profile: qualified, path: "core/elsewhere.md", text: from })).toBe(from);
  for (const text of ["unmatched", `${from} ${from}`]) expect(() => prepareQualifiedNativeDocument({ declaration, profile: qualified, path, text })).toThrow("exactly one");
  declaration.nativeReplacements![0] = { from: "new authored sentence", to: "new native sentence" };
  expect(prepareQualifiedNativeDocument({ declaration, profile: qualified, path, text: "new authored sentence" })).toBe("new native sentence");
});

const profile = { buildVersion: "2.11.3", environmentCap: null } as const;
const request: DistributionDescriptionRequest = { sourceRoot: "/source", root: "/scratch", basis: { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) }, binding, mode: 0o644, invocation: "aidlc", files: [...qualifiedDescriptionPaths(binding, "aidlc"), "AGENTS.md", ".cursor/native.md"], directories: [".cursor"], finalFiles: [{ path: "AGENTS.md", bytes: Buffer.from("agents"), mode: 0o644 }, { path: ".cursor/native.md", bytes: Buffer.from("native"), mode: 0o644 }] };
const copy: PairedCopyDescription = { profile, basis: request.basis, files: [...request.files, "install.ts"].map(path => ({ path, bytes: Buffer.from("copy"), mode: 0o644 })), inputs: [] };
const prepare = async (native: DistributionDescriptionRequest, paired: PairedCopyDescription) => {
  const spawn = mock(() => ({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "unavailable", detail: "process reached after exact inventory admission" }) }));
  const result = await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair: { profile, copy: paired }, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare(native);
  return { result, spawn };
};

test("native inventory admits exactly the declared omitted copy resource", async () => {
  const { result, spawn } = await prepare(request, copy);
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(result.status).toBe("invalid");
  if (result.status === "invalid") expect(result.findings[0]!.detail).toContain("process reached");
});

test.each([
  { name: "missing copy installer", copy: { ...copy, files: copy.files.filter(file => file.path !== "install.ts") } },
  { name: "extra safe copy path", copy: { ...copy, files: [...copy.files, { path: "foreign.md", bytes: Buffer.from("foreign"), mode: 0o644 }] } },
  { name: "duplicate copy path", copy: { ...copy, files: [...copy.files, copy.files[0]!] } },
  { name: "wrong source", copy: { ...copy, basis: { ...copy.basis, pin: "b".repeat(40) } } },
  { name: "wrong version", copy: { ...copy, profile: { ...profile, buildVersion: "2.11.4-preview.20261107.1" } } },
  { name: "wrong cap", copy: { ...copy, profile: { ...profile, environmentCap: "templated" as const } } },
])("native pair refuses $name before process work", async candidate => {
  const { result, spawn } = await prepare(request, candidate.copy);
  expect(result.status).toBe("invalid"); expect(spawn).not.toHaveBeenCalled();
});

test("native refuses leaked installer, omitted final bytes and duplicate native paths", async () => {
  const installer = copy.files.find(file => file.path === "install.ts")!;
  for (const native of [
    { ...request, files: [...request.files, "install.ts"], finalFiles: [...request.finalFiles!, installer] },
    { ...request, finalFiles: [] },
    { ...request, finalFiles: [...request.finalFiles!, request.finalFiles![0]!] },
  ]) {
    const { result, spawn } = await prepare(native, copy);
    expect(result.status).toBe("invalid"); expect(spawn).not.toHaveBeenCalled();
  }
});

import { parseAgentSource } from "../../scripts/projection/src/adapters/agent-source.ts";
import { resolveAgentPolicy } from "../../scripts/projection/src/domain/agent-policy.ts";
import type { AgentContext } from "../../scripts/projection/src/domain/agent-definition.ts";

test("authored turn limits require an explicit metadata interpretation without claiming enforcement", () => {
  const authored = parseAgentSource({ text: "---\nname: aidlc-example-agent\ndisplay_name: Example\ndescription: Example\ndisallowedTools: Task\ntier: balanced\nmaxTurns: 19\n---\nPersona.\n", origin: { ...request.basis, path: "core/agents/aidlc-example-agent.md" } });
  expect(authored.status).toBe("ok");
  if (authored.status !== "ok") return;
  const context: AgentContext = { ...binding, invocation: "aidlc", tierCap: "judgment", sharedKnowledge: "methodology-only", rulesSubdir: "rules", knowledgeRead: "ordinary", memoryReference: "aidlc/active-memory", models: { explicit: "preserve", tiers: { judgment: { model: null, effort: null }, balanced: { model: null, effort: null }, templated: { model: null, effort: null } } } };
  expect(resolveAgentPolicy({ agent: authored.value, context }).status).toBe("invalid");
  const preserved = resolveAgentPolicy({ agent: authored.value, context: { ...context, turnLimitProjection: "authored-metadata" } });
  expect(preserved.status).toBe("ok");
  if (preserved.status === "ok") expect(preserved.value).toBe(authored.value.policy);
  expect(authored.value.frontmatter).toContain("maxTurns: 19");
});
