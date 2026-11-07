import { mock } from "bun:test";
import type { DescriptionServices, DescribeDistributionRequest } from "../../../../../scripts/projection/src/application/describe-distribution.ts";
import type { SourceDescriptionOperations } from "../../../../../scripts/projection/src/adapters/source-distribution-description.ts";
import type { DistributionDescriptionRequest, PreparedDistributionDescription } from "../../../../../scripts/projection/src/domain/distribution-description.ts";
import { entryBasis } from "./harness-document-fixtures.ts";
export const descriptionInputs = [
  { path: "scripts/projection-metadata.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "scripts/manifest-types.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "harness/claude/manifest.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "harness/claude/onboarding.fills.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "harness/claude/.mcp.json", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "harness/claude/dot-gitignore", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/tools/aidlc-distribution.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/tools/aidlc-root-integration-codec.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/tools/aidlc-projection-path.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/tools/aidlc-channel.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/tools/aidlc-version.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
];
export const descriptionPaths = [".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json"];
export const preparedDescription: PreparedDistributionDescription = { files: [
  { path: ".gitignore", bytes: new Uint8Array([68]), mode: 0o644 }, { path: ".mcp.json", bytes: new Uint8Array([68]), mode: 0o644 },
  { path: ".claude/tools/data/root-blocks/gitignore", bytes: new Uint8Array([68]), mode: 0o644 }, { path: ".claude/tools/data/root-blocks/.mcp.json", bytes: new Uint8Array([68]), mode: 0o644 },
  { path: ".claude/tools/data/aidlc-projection.json", bytes: new Uint8Array([68]), mode: 0o644 }, { path: ".claude/tools/data/aidlc-stamp.json", bytes: new Uint8Array([68]), mode: 0o644 },
], preparation: { kind: "distribution-metadata", paths: descriptionPaths, inputs: descriptionInputs } };
export const descriptionWireFiles = [{ file: ".gitignore", bytes: [68] }, { file: ".mcp.json", bytes: [68] }, { file: ".claude/tools/data/root-blocks/gitignore", bytes: [68] }, { file: ".claude/tools/data/root-blocks/.mcp.json", bytes: [68] }, { file: ".claude/tools/data/aidlc-projection.json", bytes: [68] }, { file: ".claude/tools/data/aidlc-stamp.json", bytes: [68] }];
export const sourceDescriptionRequest: DistributionDescriptionRequest = { sourceRoot: "source", root: "scratch", basis: entryBasis, binding: { harness: "claude", directory: ".claude" }, mode: 0o644, files: [".gitignore", ".mcp.json", ".claude/tools/aidlc-version.ts"], directories: [".claude", ".claude/tools"] };
export const createSourceDescriptionFixture = (): SourceDescriptionOperations => ({ paths: mock().mockReturnValue({ sourceRoot: "/source", root: "/scratch" }), environment: mock().mockReturnValue(Object.fromEntries([["PATH", "tools"], ["SECRET", "excluded"], ["AIDLC_BUILD_VERSION", "untrusted"]])), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "ok", files: descriptionWireFiles, inputs: descriptionInputs }) }) });
export const createRevokedDescriptionFixture = (): SourceDescriptionOperations => {
  const revoked = Proxy.revocable(createSourceDescriptionFixture().spawn, {});
  revoked.revoke();
  return { ...createSourceDescriptionFixture(), spawn: revoked.proxy };
};
export const descriptionVersionPreparation = { kind: "runtime-modules", paths: [".claude/tools/aidlc-version.ts"], inputs: [{ path: "core/tools/aidlc-version.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] } as const;
export const descriptionRequest: DescribeDistributionRequest = { sourceRoot: "source", root: "scratch", mode: 0o644, seed: { basis: entryBasis, binding: { harness: "claude", directory: ".claude" }, invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", structure: { kind: "file-parents", mode: 0o755 }, files: [{ path: ".claude/tools/aidlc-version.ts", bytes: new Uint8Array([86]), mode: 0o644 }], directories: [], inputPreparations: [descriptionVersionPreparation] }, projection: { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [], resources: [{ kind: "file", path: ".claude/skills/aidlc-poc/SKILL.md", body: "runner" }] } };
export const descriptionDirectories = [{ path: ".claude", mode: 0o755 }, { path: ".claude/tools", mode: 0o755 }, { path: ".claude/tools/data", mode: 0o755 }, { path: ".claude/skills", mode: 0o755 }, { path: ".claude/skills/aidlc-poc", mode: 0o755 }];
export const createDescriptionFixture = (): DescriptionServices => ({ preparation: { prepare: mock().mockResolvedValue({ status: "ok", value: preparedDescription }) }, paths: mock().mockReturnValue(descriptionPaths), structure: mock().mockReturnValue({ status: "ok", value: descriptionDirectories }), admit: mock().mockReturnValue({ status: "ok", value: { additions: preparedDescription.files, unchanged: [] } }), rules: { path: mock().mockReturnValue("safe") } });
export const descriptionExpectedEnvironment = Object.fromEntries([["PATH", "tools"], ["HOME", "/scratch/.description-home"], ["USERPROFILE", "/scratch/.description-home"], ["APPDATA", "/scratch/.description-home"], ["LOCALAPPDATA", "/scratch/.description-home"], ["TEMP", "/scratch/.description-home"], ["TMP", "/scratch/.description-home"], ["BUN_TMPDIR", "/scratch/.description-home"], ["BUN_INSTALL", "/scratch/.description-home/bun-install"], ["BUN_INSTALL_CACHE_DIR", "/scratch/.description-home/bun-cache"], ["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]);
