import { mock, type Mock } from "bun:test";
import type { RuntimeInputRequest } from "../src/domain/runtime-inputs.ts";
import type { SourceRuntimeModuleOperations } from "../src/adapters/source-runtime-modules.ts";

export const runtimeModuleRequest: RuntimeInputRequest = { sourceRoot: "relative-source", root: "private-runtime", basis: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" }, binding: { harness: "claude", directory: ".claude" }, mode: 0o640, invocation: "bun .claude/tools/aidlc.ts" };
export const { invocation: moduleInvocation, ...runtimeModuleRequestWithoutInvocation } = runtimeModuleRequest;
export const runtimeModuleHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const runtimeModuleInputs = [
  { path: "scripts/runtime-module.ts", sha256: runtimeModuleHash },
  { path: "scripts/runtime-source.ts", sha256: runtimeModuleHash },
  { path: "scripts/plugin-runtime.ts", sha256: runtimeModuleHash },
  { path: "core/tools/aidlc-version.ts", sha256: runtimeModuleHash },
  { path: "core/tools/aidlc-plain.ts", sha256: runtimeModuleHash },
  { path: "core/tools/data/templates/.gitkeep", sha256: runtimeModuleHash },
  { path: "scripts/nested/compiler.ts", sha256: runtimeModuleHash },
  { path: "scripts/core-runtime.ts", sha256: runtimeModuleHash },
  { path: "core/projection/plugin-hook-types.ts", sha256: runtimeModuleHash },
  { path: "core/hooks/session.ts", sha256: runtimeModuleHash },
];
export const runtimeModuleFiles = [
  { file: "tools/aidlc-version.ts", content: "v\n" },
  { file: "tools/aidlc-plain.ts", content: "\uFEFFx\r\n" },
  { file: "tools/aidlc-plain.runtime.js", content: "b\n" },
  { file: "tools/core-runtime-types/types.d.cts", content: "t\n" },
  { file: "tools/core-runtime-types/package.json", content: "{}\n" },
  { file: "tools/core-runtime-types/LICENSE", content: "L\n" },
  { file: "hooks/session.ts", content: "h\n" },
  { file: "projection/plugin-hook-types.d.ts", content: "p\n" },
];
export const runtimeModuleWire = { status: "ok", files: runtimeModuleFiles, modules: ["tools/aidlc-version.ts", "tools/aidlc-plain.ts", "hooks/session.ts"], inputs: runtimeModuleInputs };
export type RuntimeModuleFixture = { readonly operations: { readonly [Key in keyof SourceRuntimeModuleOperations]: Mock<SourceRuntimeModuleOperations[Key]> } };
export const createRuntimeModuleFixture = ({ wire = runtimeModuleWire }: { readonly wire?: unknown } = {}): RuntimeModuleFixture => ({ operations: {
  paths: mock<SourceRuntimeModuleOperations["paths"]>().mockReturnValue({ sourceRoot: "/source", root: "/runtime" }),
  environment: mock<SourceRuntimeModuleOperations["environment"]>().mockReturnValue(Object.fromEntries([["PATH", "/bin"], ["API_KEY", "private"], ["NODE_OPTIONS", "foreign"], ["AIDLC_BUILD_VERSION", "foreign"]])),
  spawn: mock<SourceRuntimeModuleOperations["spawn"]>().mockReturnValue({ exitCode: 0, stdout: JSON.stringify(wire), stderr: "", error: null }),
} });
