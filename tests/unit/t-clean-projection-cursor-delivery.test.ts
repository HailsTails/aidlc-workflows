// covers: file:scripts/projection/src/adapters/qualified-delivery-policy.ts, file:scripts/projection/src/adapters/source-distribution-description.ts
import { expect, mock, test } from "bun:test";
import cursor from "../../harness/cursor/manifest.ts";
import { qualifyDeliveryDeclaration, prepareDeliveryDeclaration, prepareQualifiedNativeDocument } from "../../scripts/projection/src/adapters/qualified-delivery-policy.ts";
import { qualifiedHarnessProfile, qualifiedDescriptionPaths } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { createSourceDescriptionPreparer } from "../../scripts/projection/src/adapters/source-distribution-description.ts";
import type { DistributionDescriptionRequest, PairedCopyDescription } from "../../scripts/projection/src/domain/distribution-description.ts";
import { parseAgentSource } from "../../scripts/projection/src/adapters/agent-source.ts";
import { resolveAgentPolicy } from "../../scripts/projection/src/domain/agent-policy.ts";
import type { AgentContext } from "../../scripts/projection/src/domain/agent-definition.ts";
import { ordinaryCursorResources, flaggedCursorResources, cursorWithoutReplacements, rootIntegrationPaths, copyDescriptionFiles, requireSuccessfulOutcome } from "./t-projection-delivery-fixtures.ts";

const binding = { harness: "cursor", directory: ".cursor" } as const;
const qualified = qualifiedHarnessProfile(binding)!;
const installerResource = { src: "install.ts", dst: "install.ts", projectRoot: true, copyOnly: true };
const ownedRoots = [cursor.rootIntegrations[0]!, cursor.rootIntegrations[1]!];
const inventoryFailure = "native final bytes and metadata must cover their exact inventory; paired copy must add exactly the qualified copy-only roots";
const pairingFailure = "native delivery requires final bytes and an explicitly paired copy artifact from the same source and version/cap profile";

test("Cursor resources have explicit delivery and root ownership, independent of invocation policy", () => {
  expect(qualified.modelInvocation).toBe("native-default");
  expect(qualified.agentMemoryReference).toBe("aidlc/active-memory");
  expect(() => qualifyDeliveryDeclaration(cursor, qualified)).not.toThrow();
  expect(qualifiedDescriptionPaths(binding, "bun .cursor/tools/aidlc.ts")).toContain("install.ts");
  expect(qualifiedDescriptionPaths(binding, "aidlc")).not.toContain("install.ts");
  expect(prepareDeliveryDeclaration(cursor, qualified, "copy")).toBe(cursor);
  expect(rootIntegrationPaths(prepareDeliveryDeclaration(cursor, qualified, "native"))).toEqual([".gitignore", "AGENTS.md"]);
  expect(rootIntegrationPaths(cursor)).toContain("install.ts");
});

test.each([
  { name: "other host", declaration: { ...cursor, name: "claude" }, reason: "delivery requires the qualified authored manifest" },
  { name: "other directory", declaration: { ...cursor, harnessDir: ".foreign" }, reason: "delivery requires the qualified authored manifest" },
  { name: "missing resource", declaration: { ...cursor, harnessFiles: ordinaryCursorResources }, reason: "delivery does not admit unqualified copyOnly resources or root ownership" },
  { name: "duplicate resource", declaration: { ...cursor, harnessFiles: [...cursor.harnessFiles, installerResource] }, reason: "delivery does not admit unqualified copyOnly resources or root ownership" },
  { name: "redirected source", declaration: { ...cursor, harnessFiles: [...ordinaryCursorResources, { ...installerResource, src: "other.ts" }] }, reason: "delivery does not admit unqualified copyOnly resources or root ownership" },
  { name: "redirected destination", declaration: { ...cursor, harnessFiles: [...ordinaryCursorResources, { ...installerResource, dst: "other.ts" }] }, reason: "delivery does not admit unqualified copyOnly resources or root ownership" },
  { name: "non-root resource", declaration: { ...cursor, harnessFiles: [...ordinaryCursorResources, { ...installerResource, projectRoot: false }] }, reason: "delivery does not admit unqualified copyOnly resources or root ownership" },
  { name: "ordinary copy-only flag", declaration: { ...cursor, harnessFiles: flaggedCursorResources }, reason: "delivery does not admit unqualified copyOnly resources or root ownership" },
  { name: "wrong root owner", declaration: { ...cursor, rootIntegrations: [...ownedRoots, { path: "install.ts", policy: "managed-block", marker: "installer" }] }, reason: "delivery does not admit unqualified copyOnly resources or root ownership" },
  { name: "native root declaration", declaration: { ...cursor, nativeRootIntegrations: [] }, reason: "delivery does not admit nativeRootIntegrations declarations" },
  { name: "missing replacement", declaration: cursorWithoutReplacements, reason: "delivery does not admit unqualified nativeReplacements declarations" },
  { name: "extra replacement", declaration: { ...cursor, nativeReplacements: [...cursor.nativeReplacements!, { from: "extra", to: "native" }] }, reason: "delivery does not admit unqualified nativeReplacements declarations" },
  { name: "empty replacement", declaration: { ...cursor, nativeReplacements: [{ ...cursor.nativeReplacements![0]!, from: "" }] }, reason: "delivery does not admit unqualified nativeReplacements declarations" },
])("delivery refuses $name", candidate => {
  expect(() => qualifyDeliveryDeclaration(candidate.declaration, qualified)).toThrow(candidate.reason);
});

const authoredInvocation = "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),";
const nativeDocumentPath = "harness/cursor/rules-aidlc.mdc";

test("native replacement is source-owned, targeted, unique and before issuance", () => {
  expect(prepareQualifiedNativeDocument({ declaration: cursor, profile: qualified, path: nativeDocumentPath, text: `before ${authoredInvocation} after` })).toBe("before run `aidlc doctor`, after");
  expect(prepareQualifiedNativeDocument({ declaration: cursor, profile: qualified, path: "core/elsewhere.md", text: authoredInvocation })).toBe(authoredInvocation);
  expect(() => prepareQualifiedNativeDocument({ declaration: cursor, profile: qualified, path: nativeDocumentPath, text: "unmatched" })).toThrow("exactly one");
  expect(() => prepareQualifiedNativeDocument({ declaration: cursor, profile: qualified, path: nativeDocumentPath, text: `${authoredInvocation} ${authoredInvocation}` })).toThrow("exactly one");
  expect(prepareQualifiedNativeDocument({ declaration: { ...cursor, nativeReplacements: [{ from: "new authored sentence", to: "new native sentence" }] }, profile: qualified, path: nativeDocumentPath, text: "new authored sentence" })).toBe("new native sentence");
});

const profile = { buildVersion: "2.11.3", environmentCap: null } as const;
// Inventories are fixture facts, independent of qualifiedDescriptionPaths admission policy.
const request: DistributionDescriptionRequest = { sourceRoot: "/source", root: "/scratch", basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, binding, mode: 0o644, invocation: "aidlc", files: [".gitignore", ".cursor/tools/data/root-blocks/gitignore", ".cursor/tools/data/root-blocks/agents", ".cursor/tools/data/aidlc-projection.json", ".cursor/tools/data/aidlc-stamp.json", "AGENTS.md", ".cursor/native.md"], directories: [".cursor"], finalFiles: [{ path: "AGENTS.md", bytes: Buffer.from("agents"), mode: 0o644 }, { path: ".cursor/native.md", bytes: Buffer.from("native"), mode: 0o644 }] };
const copy: PairedCopyDescription = { profile, basis: request.basis, files: copyDescriptionFiles([".gitignore", ".cursor/tools/data/root-blocks/gitignore", ".cursor/tools/data/root-blocks/agents", ".cursor/tools/data/aidlc-projection.json", ".cursor/tools/data/aidlc-stamp.json", "AGENTS.md", ".cursor/native.md", "install.ts"]), inputs: [] };
const prepare = async (native: DistributionDescriptionRequest, paired: PairedCopyDescription) => {
  const spawn = mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: '{"status":"unavailable","detail":"process reached after exact inventory admission"}' });
  const preparation = await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair: { profile, copy: paired }, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare(native);
  return { preparation, spawn };
};

test("native inventory admits exactly the declared omitted copy resource", async () => {
  const { preparation, spawn } = await prepare(request, copy);
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(preparation.status).toBe("invalid");
  expect(preparation).toMatchObject({ findings: [{ code: "capability-gap", detail: "process reached after exact inventory admission" }] });
});

test.each([
  { name: "missing copy installer", copy: { ...copy, files: copyDescriptionFiles([".gitignore", ".cursor/tools/data/root-blocks/gitignore", ".cursor/tools/data/root-blocks/agents", ".cursor/tools/data/aidlc-projection.json", ".cursor/tools/data/aidlc-stamp.json", "AGENTS.md", ".cursor/native.md"]) }, reason: inventoryFailure },
  { name: "extra safe copy path", copy: { ...copy, files: [...copy.files, { path: "foreign.md", bytes: Buffer.from("foreign"), mode: 0o644 }] }, reason: inventoryFailure },
  { name: "duplicate copy path", copy: { ...copy, files: [...copy.files, copy.files[0]!] }, reason: inventoryFailure },
  { name: "wrong source", copy: { ...copy, basis: { ...copy.basis, pin: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } }, reason: pairingFailure },
  { name: "wrong version", copy: { ...copy, profile: { ...profile, buildVersion: "2.11.4-preview.20261107.1" } }, reason: pairingFailure },
  { name: "wrong cap", copy: { ...copy, profile: { ...profile, environmentCap: "templated" as const } }, reason: pairingFailure },
])("native pair refuses $name before process work", async candidate => {
  const { preparation, spawn } = await prepare(request, candidate.copy);
  expect(preparation.status).toBe("invalid");
  expect(preparation).toMatchObject({ findings: [{ code: "foreign-content", detail: candidate.reason }] });
  expect(spawn).not.toHaveBeenCalled();
});

test("native refuses leaked installer, omitted final bytes and duplicate native paths", async () => {
  const leakedInstaller = await prepare({ ...request, files: [...request.files, "install.ts"], finalFiles: [...request.finalFiles!, { path: "install.ts", bytes: Buffer.from("copy"), mode: 0o644 }] }, copy);
  expect(leakedInstaller.preparation.status).toBe("invalid");
  expect(leakedInstaller.preparation).toMatchObject({ findings: [{ code: "foreign-content", detail: inventoryFailure }] });
  expect(leakedInstaller.spawn).not.toHaveBeenCalled();

  const omittedBytes = await prepare({ ...request, finalFiles: [] }, copy);
  expect(omittedBytes.preparation.status).toBe("invalid");
  expect(omittedBytes.preparation).toMatchObject({ findings: [{ code: "foreign-content", detail: inventoryFailure }] });
  expect(omittedBytes.spawn).not.toHaveBeenCalled();

  const duplicatePaths = await prepare({ ...request, finalFiles: [...request.finalFiles!, request.finalFiles![0]!] }, copy);
  expect(duplicatePaths.preparation.status).toBe("invalid");
  expect(duplicatePaths.preparation).toMatchObject({ findings: [{ code: "foreign-content", detail: inventoryFailure }] });
  expect(duplicatePaths.spawn).not.toHaveBeenCalled();
});

test("authored turn limits require an explicit metadata interpretation without claiming enforcement", () => {
  const authored = parseAgentSource({ text: "---\nname: aidlc-example-agent\ndisplay_name: Example\ndescription: Example\ndisallowedTools: Task\ntier: balanced\nmaxTurns: 19\n---\nPersona.\n", origin: { ...request.basis, path: "core/agents/aidlc-example-agent.md" } });
  expect(authored.status).toBe("ok");
  const agent = requireSuccessfulOutcome(authored);
  const context: AgentContext = { ...binding, invocation: "aidlc", tierCap: "judgment", sharedKnowledge: "methodology-only", rulesSubdir: "rules", knowledgeRead: "ordinary", memoryReference: "aidlc/active-memory", models: { explicit: "preserve", tiers: { judgment: { model: null, effort: null }, balanced: { model: null, effort: null }, templated: { model: null, effort: null } } } };
  expect(resolveAgentPolicy({ agent, context }).status).toBe("invalid");
  const preserved = resolveAgentPolicy({ agent, context: { ...context, turnLimitProjection: "authored-metadata" } });
  expect(preserved.status).toBe("ok");
  expect(requireSuccessfulOutcome(preserved)).toBe(agent.policy);
  expect(agent.frontmatter).toContain("maxTurns: 19");
});
