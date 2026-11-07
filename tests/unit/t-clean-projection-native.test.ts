// covers: file:scripts/project-claude.ts, file:scripts/projection/native/native-delivery.ts
import { expect, test } from "bun:test";
import { finalizeClaudeNativeMetadata } from "../../scripts/projection/native/native-delivery.ts";
import { createSourceDescriptionPreparer } from "../../scripts/projection/src/adapters/source-distribution-description.ts";
import type { DistributionDescriptionRequest, PairedCopyDescription } from "../../scripts/projection/src/domain/distribution-description.ts";
import { describeDistribution } from "../../scripts/projection/src/application/describe-distribution.ts";
import { createDescriptionFixture, descriptionRequest } from "./projection/support/__tests__/distribution-description-fixtures.ts";

import { copyDescriptionFiles, createForbiddenDescriptionSpawn, readPreparedDescriptor } from "./t-projection-delivery-fixtures.ts";

const bytes = (text: string) => Buffer.from(text);
const descriptorPath = ".claude/tools/data/aidlc-projection.json";
const artifacts = [{ file: descriptorPath, bytes: bytes(JSON.stringify({ managedDirectories: [".claude", "aidlc"], rootIntegrations: [] })) }];
const nativeFiles = [{ path: ".claude/changed.md", bytes: bytes("native") }, { path: ".claude/same.md", bytes: bytes("same") }, { path: "aidlc/seed.md", bytes: bytes("native seed") }];
const copyFiles = [{ path: descriptorPath, sha256: "sha256:73a2aab31fde5c3d11aff6c29fb37d646cba85ffc8404d7432f9d4d1e4c33634" }, { path: ".claude/changed.md", sha256: "sha256:6f5a6034e770acbfb3f797e6a7eb7948d470d45f9928f92b7d72dc7c45e6d0cd" }, { path: ".claude/same.md", sha256: "sha256:0967115f2813a3541eaef77de9d9d5773f1c0c04314b0bbfe4ff3b3b1c55b5d5" }, { path: "aidlc/seed.md", sha256: "sha256:52621df8193aa6aebb727313c52ecbef2dcab2fcfc6c14a4d71f462ec15a0dd4" }];
const history = { ".claude/changed.md": ["sha256:f5dbf9fe930c4f499bc6573d86f0156f86ed10363bfee0a71efb3eacce58410f", "sha256:bef32d2c315a289576f2a6828d27edb16bb316a4d85c271f2d794045f3ea668d", "sha256:f5dbf9fe930c4f499bc6573d86f0156f86ed10363bfee0a71efb3eacce58410f"], ".claude/same.md": ["sha256:0967115f2813a3541eaef77de9d9d5773f1c0c04314b0bbfe4ff3b3b1c55b5d5"], ".claude/retired.md": ["sha256:5b720147b6918dfc19baa0d7767cab75b76e17998837d04af43f2f3463c5350f", "sha256:5b720147b6918dfc19baa0d7767cab75b76e17998837d04af43f2f3463c5350f"], "aidlc/seed.md": ["sha256:04caf61cb14efb0f7b9e570ecdec236dc5b5680848f70295508b8ff3e515aa2d"], "elsewhere/user.md": ["sha256:04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb"], [descriptorPath]: ["sha256:8b416346241008579431ed939f0ad232e1f18daed955faf4fbda88a1db60c0cc"] };

test("native metadata recognizes current and historical copies, retires old paths and excludes seeds", () => {
  const preparation = finalizeClaudeNativeMetadata({ artifacts, nativeFiles, copyFiles, history });
  expect(preparation.kind).toBe("prepared");
  const descriptor = readPreparedDescriptor(preparation);
  expect(descriptor.legacyManagedFileHashes).toEqual({ ".claude/changed.md": ["sha256:6f5a6034e770acbfb3f797e6a7eb7948d470d45f9928f92b7d72dc7c45e6d0cd", "sha256:f5dbf9fe930c4f499bc6573d86f0156f86ed10363bfee0a71efb3eacce58410f"], [descriptorPath]: ["sha256:73a2aab31fde5c3d11aff6c29fb37d646cba85ffc8404d7432f9d4d1e4c33634"] });
  expect(descriptor.retiredCopyFileHashes).toEqual({ ".claude/retired.md": ["sha256:5b720147b6918dfc19baa0d7767cab75b76e17998837d04af43f2f3463c5350f"] });
  expect(Buffer.from(artifacts[0]!.bytes).toString()).not.toContain("legacyManagedFileHashes");
});

test.each([
  [{ history: { "../escape": ["sha256:cba06b5736faf67e54b07b561eae94395e774c517a7d910a54369e1263ccfbd4"] } }, "native delivery requires safe copy-era paths and SHA-256 signatures"] as const,
  [{ history: { ".claude/file": ["invalid"] } }, "native delivery requires safe copy-era paths and SHA-256 signatures"] as const,
  [{ copyFiles: [copyFiles[1]!, copyFiles[2]!, copyFiles[3]!] }, "native delivery requires its producer descriptor and the paired copy descriptor"] as const,
  [{ copyFiles: [...copyFiles, copyFiles[0]!] }, "native delivery requires unique safe file paths in each paired artifact"] as const,
  [{ nativeFiles: [...nativeFiles, { path: ".claude/bad.md", bytes: bytes("bun .claude/tools/aidlc.ts status") }] }, ".claude/bad.md: bun invocation survived native projection"] as const,
  [{ nativeFiles: [...nativeFiles, { path: ".claude/bad.md", bytes: bytes("aidlc engine utility") }] }, ".claude/bad.md: retired engine alias survived native projection"] as const,
])("native finalization refuses incomplete or unsafe inputs: %j", (change, reason) => {
  const preparation = finalizeClaudeNativeMetadata({ artifacts, nativeFiles, copyFiles, history, ...change });
  expect(preparation.kind).toBe("refused");
  expect(preparation).toMatchObject({ message: expect.stringContaining(reason) });
});

const profile = { buildVersion: "2.11.3", environmentCap: null } as const;
const request: DistributionDescriptionRequest = { sourceRoot: "/source", root: "/scratch", basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, binding: { harness: "claude", directory: ".claude" }, mode: 0o644, invocation: "aidlc", files: [".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/native.md"], directories: [".claude"], finalFiles: [{ path: ".claude/native.md", bytes: bytes("native"), mode: 0o644 }] };
const copy: PairedCopyDescription = { profile, basis: request.basis, files: copyDescriptionFiles([".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/native.md"]), inputs: [] };

const pairingFailure = "native delivery requires final bytes and an explicitly paired copy artifact from the same source and version/cap profile";
const inventoryFailure = "native final bytes and metadata must cover their exact inventory; paired copy must add exactly the qualified copy-only roots";

test.each([
  [{ profile: { ...profile, environmentCap: "templated" as const }, copy }, pairingFailure] as const,
  [{ profile, copy: { ...copy, profile: { ...profile, buildVersion: "2.11.4-preview.20261107.1" } } }, pairingFailure] as const,
  [{ profile, copy: { ...copy, basis: { ...copy.basis, pin: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } } }, pairingFailure] as const,
  [{ profile, copy: { ...copy, files: [copy.files[1]!, copy.files[2]!, copy.files[3]!, copy.files[4]!, copy.files[5]!, copy.files[6]!] } }, inventoryFailure] as const,
])("native description rejects wrong profile, source or incomplete pair before spawning: %j", async (nativePair, reason) => {
  const spawn = createForbiddenDescriptionSpawn();
  const preparation = await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare(request);
  expect(preparation.status).toBe("invalid");
  expect(preparation).toMatchObject({ findings: [{ code: "foreign-content", detail: reason }] });
  expect(spawn).not.toHaveBeenCalled();
});

test("native description refuses truncated native bytes before spawning", async () => {
  const spawn = createForbiddenDescriptionSpawn();
  const preparation = await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair: { profile, copy }, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare({ ...request, finalFiles: [] });
  expect(preparation.status).toBe("invalid");
  expect(preparation).toMatchObject({ findings: [{ code: "foreign-content", detail: inventoryFailure }] });
  expect(spawn).not.toHaveBeenCalled();
});

test("matching native inventory reaches and reports the injected process failure", async () => {
  const spawn = createForbiddenDescriptionSpawn();
  const preparation = await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair: { profile, copy }, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare(request);
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(preparation).toMatchObject({ status: "invalid", findings: [{ code: "capability-gap", detail: "distribution description process capability unavailable" }] });
});

test("description final bytes use the assembly encoder and include new resources", async () => {
  const services = createDescriptionFixture();
  await describeDistribution({ request: { ...descriptionRequest, seed: { ...descriptionRequest.seed, invocation: "aidlc" } }, services: { ...services, rules: { ...services.rules, encode: ({ text }) => bytes(`!${text}`) } } });
  expect(services.preparation.prepare).toHaveBeenCalledWith(expect.objectContaining({ finalFiles: [
    { path: ".claude/tools/aidlc-version.ts", bytes: bytes("V"), mode: 0o644 },
    { path: ".claude/skills/aidlc-poc/SKILL.md", bytes: bytes("!runner"), mode: 0o644 },
  ] }));
});
