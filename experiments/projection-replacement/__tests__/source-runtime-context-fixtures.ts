import { mock, type Mock } from "bun:test";
import type { DistributionContextLocation } from "../src/domain/distribution-context.ts";
import type { SourceRuntimeContextOperations } from "../src/adapters/source-runtime-context.ts";

export const sourceContextLocation: DistributionContextLocation = { location: { sourceRoot: "relative-source", root: "private-context", basis: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" } }, binding: { harness: "claude", directory: ".claude" } };
export const sourceContextDigest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const sourceContextInputs = [
  { path: "harness/claude/manifest.ts", sha256: sourceContextDigest }, { path: "harness/claude/onboarding.fills.ts", sha256: sourceContextDigest },
  { path: "scripts/harness-runtime-data.ts", sha256: sourceContextDigest }, { path: "core/tools/aidlc-runtime-paths.ts", sha256: sourceContextDigest },
];
export const sourceContextDescriptor = { schemaVersion: 1, distribution: "claude", productName: "Native", configNextStep: "Next", name: "claude", harnessDir: ".claude", rulesSubdir: "rules", future: true };
export const sourceContextWire = { status: "ok", descriptor: sourceContextDescriptor, invocation: "bun .claude/tools/aidlc.ts", inputs: sourceContextInputs };
export const sourceContextBytes = new Uint8Array([123,10,32,32,34,115,99,104,101,109,97,86,101,114,115,105,111,110,34,58,32,49,44,10,32,32,34,100,105,115,116,114,105,98,117,116,105,111,110,34,58,32,34,99,108,97,117,100,101,34,44,10,32,32,34,112,114,111,100,117,99,116,78,97,109,101,34,58,32,34,78,97,116,105,118,101,34,44,10,32,32,34,99,111,110,102,105,103,78,101,120,116,83,116,101,112,34,58,32,34,78,101,120,116,34,44,10,32,32,34,110,97,109,101,34,58,32,34,99,108,97,117,100,101,34,44,10,32,32,34,104,97,114,110,101,115,115,68,105,114,34,58,32,34,46,99,108,97,117,100,101,34,44,10,32,32,34,114,117,108,101,115,83,117,98,100,105,114,34,58,32,34,114,117,108,101,115,34,44,10,32,32,34,102,117,116,117,114,101,34,58,32,116,114,117,101,10,125,10]);
export type SourceRuntimeContextFixture = { readonly operations: { readonly [Key in keyof SourceRuntimeContextOperations]: Mock<SourceRuntimeContextOperations[Key]> } };
export const createSourceRuntimeContextFixture = ({ wire = sourceContextWire }: { readonly wire?: unknown } = {}): SourceRuntimeContextFixture => ({ operations: {
  paths: mock<SourceRuntimeContextOperations["paths"]>().mockReturnValue({ sourceRoot: "/source", root: "/context" }),
  environment: mock<SourceRuntimeContextOperations["environment"]>().mockReturnValue(Object.fromEntries([["PATH", "/bin"], ["HOME", "foreign-home"], ["API_KEY", "private"], ["AIDLC_HARNESS_DIR", ".foreign"], ["AIDLC_HARNESS_NAME", "foreign"]])),
  spawn: mock<SourceRuntimeContextOperations["spawn"]>().mockReturnValue({ exitCode: 0, stdout: JSON.stringify(wire), stderr: "", error: null }),
} });
