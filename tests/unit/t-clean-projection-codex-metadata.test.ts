// covers: file:scripts/projection/native/native-delivery.ts, file:scripts/projection/src/adapters/source-distribution-description.ts
import { expect, mock, test } from "bun:test";
import { sha256Bytes } from "../../core/tools/aidlc-distribution.ts";
import { finalizeNativeMetadata } from "../../scripts/projection/native/native-delivery.ts";
import { qualifiedHarnessProfile } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { createSourceDescriptionPreparer } from "../../scripts/projection/src/adapters/source-distribution-description.ts";
import type { DistributionDescriptionRequest } from "../../scripts/projection/src/domain/distribution-description.ts";

const bytes = (value: string) => Buffer.from(value);
const digest = (value: string) => sha256Bytes(bytes(value));
const descriptorPath = ".codex/tools/data/aidlc-projection.json";
const artifacts = [{ file: descriptorPath, bytes: bytes(JSON.stringify({ managedDirectories: [".agents", ".codex", "aidlc"], rootIntegrations: [] })) }];
const nativeFiles = [{ path: ".agents/skills/aidlc/SKILL.md", bytes: bytes("native skill") }, { path: ".codex/hooks/settings.json", bytes: bytes("{}") }, { path: "aidlc/seed.md", bytes: bytes("native seed") }];
const copyFiles = [{ path: descriptorPath, sha256: digest("copy descriptor") }, ...nativeFiles.map(file => ({ path: file.path, sha256: digest("copy") }))];

test("Codex native metadata retains both managed scopes, history and seed exclusion", () => {
  const result = finalizeNativeMetadata({ harnessDir: ".codex", artifacts, nativeFiles, copyFiles, history: { ".agents/retired.md": [digest("old")], ".codex/retired.md": [digest("old")], "aidlc/seed.md": [digest("old")], ".claude/foreign.md": [digest("old")] } });
  expect(result.kind).toBe("prepared");
  if (result.kind !== "prepared") return;
  const descriptor = JSON.parse(Buffer.from(result.artifacts[0]!.bytes).toString());
  expect(Object.keys(descriptor.legacyManagedFileHashes)).toEqual([".agents/skills/aidlc/SKILL.md", ".codex/hooks/settings.json", descriptorPath]);
  expect(descriptor.legacyManagedFileHashes[descriptorPath]).toEqual([digest("copy descriptor")]);
  expect(Object.keys(descriptor.retiredCopyFileHashes)).toEqual([".agents/retired.md", ".codex/retired.md"]);
});

test("Codex final command validation uses .codex rather than .claude context", () => {
  const result = finalizeNativeMetadata({ harnessDir: ".codex", artifacts, nativeFiles: [...nativeFiles, { path: ".agents/skills/aidlc/bad.md", bytes: bytes("bun .codex/tools/aidlc.ts status") }], copyFiles, history: {} });
  expect(result.kind).toBe("refused");
});

const profile = { buildVersion: "2.11.3", environmentCap: null } as const;
const binding = { harness: "codex", directory: ".codex" } as const;
const metadataPaths = qualifiedHarnessProfile(binding)!.descriptionPaths;
const request: DistributionDescriptionRequest = { sourceRoot: "/source", root: "/scratch", basis: { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) }, binding, mode: 0o644, invocation: "aidlc", files: [...metadataPaths, "AGENTS.md"], directories: [".codex"], finalFiles: [{ path: "AGENTS.md", bytes: bytes("final onboarding"), mode: 0o644 }] };

test("Codex metadata does not claim AGENTS.md or .mcp.json as a metadata-owned output", () => {
  expect(metadataPaths).toHaveLength(5);
  expect(metadataPaths).toContain(".codex/tools/data/root-blocks/agents");
  expect(metadataPaths).not.toContain("AGENTS.md");
  expect(metadataPaths).not.toContain(".mcp.json");
});

test("Codex description sends final root product bytes with its explicitly paired copy", async () => {
  const spawn = mock((_input: { input: string }) => ({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "unavailable", detail: "test capture" }) }));
  await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair: { profile, copy: { profile, basis: request.basis, files: request.files.map(path => ({ path, bytes: bytes("copy"), mode: 0o644 })), inputs: [] } }, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare(request);
  expect(spawn).toHaveBeenCalledTimes(1);
  const input = JSON.parse(spawn.mock.calls[0]![0].input);
  expect(input.profile.projectedRootPaths).toEqual(["AGENTS.md"]);
  expect(input.finalFiles).toEqual([{ path: "AGENTS.md", base64: bytes("final onboarding").toString("base64") }]);
  expect(input.paths).not.toContain("harness/claude/manifest.ts");
  expect(input.paths).toContain("harness/codex/manifest.ts");
});
