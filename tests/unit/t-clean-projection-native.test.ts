// covers: file:scripts/project-claude.ts, file:scripts/projection/native/native-delivery.ts
import { expect, mock, test } from "bun:test";
import { sha256Bytes } from "../../core/tools/aidlc-distribution.ts";
import { finalizeClaudeNativeMetadata } from "../../scripts/projection/native/native-delivery.ts";
import { createSourceDescriptionPreparer } from "../../scripts/projection/src/adapters/source-distribution-description.ts";
import { claudeDistributionDescriptionPaths, type DistributionDescriptionRequest, type PairedCopyDescription } from "../../scripts/projection/src/domain/distribution-description.ts";
import { describeDistribution } from "../../scripts/projection/src/application/describe-distribution.ts";
import { createDescriptionFixture, descriptionRequest } from "./projection/support/__tests__/distribution-description-fixtures.ts";

const bytes = (value: string) => Buffer.from(value);
const digest = (value: string) => sha256Bytes(bytes(value));
const descriptorPath = ".claude/tools/data/aidlc-projection.json";
const artifacts = [{ file: descriptorPath, bytes: bytes(JSON.stringify({ managedDirectories: [".claude", "aidlc"], rootIntegrations: [] })) }];
const nativeFiles = [{ path: ".claude/changed.md", bytes: bytes("native") }, { path: ".claude/same.md", bytes: bytes("same") }, { path: "aidlc/seed.md", bytes: bytes("native seed") }];
const copyFiles = [{ path: descriptorPath, sha256: digest("copy descriptor") }, { path: ".claude/changed.md", sha256: digest("copy") }, { path: ".claude/same.md", sha256: digest("same") }, { path: "aidlc/seed.md", sha256: digest("copy seed") }];
const history = { ".claude/changed.md": [digest("historical"), digest("native"), digest("historical")], ".claude/same.md": [digest("same")], ".claude/retired.md": [digest("retired"), digest("retired")], "aidlc/seed.md": [digest("old seed")], "elsewhere/user.md": [digest("user")], [descriptorPath]: [digest("historic descriptor")] };

test("native metadata recognizes current and historical copies, retires old paths and excludes seeds", () => {
  const result = finalizeClaudeNativeMetadata({ artifacts, nativeFiles, copyFiles, history });
  expect(result.kind).toBe("prepared");
  if (result.kind !== "prepared") return;
  const descriptor = JSON.parse(Buffer.from(result.artifacts[0]!.bytes).toString());
  expect(descriptor.legacyManagedFileHashes).toEqual({ ".claude/changed.md": [digest("copy"), digest("historical")].sort(), [descriptorPath]: [digest("copy descriptor")] });
  expect(descriptor.retiredCopyFileHashes).toEqual({ ".claude/retired.md": [digest("retired")] });
  expect(Buffer.from(artifacts[0]!.bytes).toString()).not.toContain("legacyManagedFileHashes");
});

test.each([
  { history: { "../escape": [digest("old")] } },
  { history: { ".claude/file": ["invalid"] } },
  { copyFiles: copyFiles.filter(file => file.path !== descriptorPath) },
  { copyFiles: [...copyFiles, copyFiles[0]!] },
  { nativeFiles: [...nativeFiles, { path: ".claude/bad.md", bytes: bytes("bun .claude/tools/aidlc.ts status") }] },
  { nativeFiles: [...nativeFiles, { path: ".claude/bad.md", bytes: bytes("aidlc engine utility") }] },
])("native finalization refuses incomplete or unsafe inputs: %j", change => {
  expect(finalizeClaudeNativeMetadata({ artifacts, nativeFiles, copyFiles, history, ...change }).kind).toBe("refused");
});

const profile = { buildVersion: "2.11.3", environmentCap: null } as const;
const request: DistributionDescriptionRequest = { sourceRoot: "/source", root: "/scratch", basis: { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) }, binding: { harness: "claude", directory: ".claude" }, mode: 0o644, invocation: "aidlc", files: [...claudeDistributionDescriptionPaths(), ".claude/native.md"], directories: [".claude"], finalFiles: [{ path: ".claude/native.md", bytes: bytes("native"), mode: 0o644 }] };
const copy: PairedCopyDescription = { profile, basis: request.basis, files: request.files.map(path => ({ path, bytes: bytes("copy"), mode: 0o644 })), inputs: [] };

test.each([
  { profile: { ...profile, environmentCap: "templated" as const }, copy },
  { profile, copy: { ...copy, profile: { ...profile, buildVersion: "2.11.4-preview.20261107.1" } } },
  { profile, copy: { ...copy, basis: { ...copy.basis, pin: "b".repeat(40) } } },
  { profile, copy: { ...copy, files: copy.files.slice(1) } },
])("native description rejects wrong profile, source or incomplete pair before spawning: %j", async nativePair => {
  const spawn = mock(() => { throw new Error("must not spawn"); });
  const result = await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare(request);
  expect(result.status).toBe("invalid");
  expect(spawn).not.toHaveBeenCalled();
});

test("native description refuses truncated native bytes before spawning", async () => {
  const spawn = mock(() => { throw new Error("must not spawn"); });
  expect((await createSourceDescriptionPreparer({ buildVersion: profile.buildVersion, nativePair: { profile, copy }, operations: { paths: () => ({ sourceRoot: "/source", root: "/scratch" }), environment: () => ({}), spawn } }).prepare({ ...request, finalFiles: [] })).status).toBe("invalid");
  expect(spawn).not.toHaveBeenCalled();
});

test("description final bytes use the assembly encoder and include new resources", async () => {
  const services = createDescriptionFixture();
  await describeDistribution({ request: { ...descriptionRequest, seed: { ...descriptionRequest.seed, invocation: "aidlc" } }, services: { ...services, rules: { ...services.rules, encode: ({ text }) => bytes(`!${text}`) } } });
  expect(services.preparation.prepare).toHaveBeenCalledWith(expect.objectContaining({ finalFiles: [
    descriptionRequest.seed.files[0],
    { path: ".claude/skills/aidlc-poc/SKILL.md", bytes: bytes("!runner"), mode: 0o644 },
  ] }));
});
