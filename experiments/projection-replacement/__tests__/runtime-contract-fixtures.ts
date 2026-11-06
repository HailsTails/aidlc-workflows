import { mock, type Mock } from "bun:test";
import type { RuntimeInputRequest } from "../src/domain/runtime-inputs.ts";
import type { SourceRuntimeContractOperations } from "../src/adapters/source-runtime-contracts.ts";
export const runtimeContractRequest: RuntimeInputRequest = { sourceRoot: "relative-source", root: "private-runtime", basis: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" }, binding: { harness: "claude", directory: ".claude" }, mode: 0o640 };
export const runtimeContractHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const runtimeContractInputs = [
  { path: "core/tools/aidlc-settings.ts", sha256: runtimeContractHash },
  { path: "core/tools/aidlc-model-policy.ts", sha256: runtimeContractHash },
  { path: "core/agents/quality-agent.md", sha256: runtimeContractHash },
  { path: "core/agents/knowledge/.gitkeep", sha256: runtimeContractHash },
];
export const runtimeContractWire = { status: "ok", schema: { z: 1, a: 2 }, serializedTiers: "native-opaque\r\n", inputs: runtimeContractInputs };
export type RuntimeContractFixture = { readonly operations: { readonly [Key in keyof SourceRuntimeContractOperations]: Mock<SourceRuntimeContractOperations[Key]> } };
export const createRuntimeContractFixture = ({ wire = runtimeContractWire }: { readonly wire?: unknown } = {}): RuntimeContractFixture => ({ operations: {
  paths: mock<SourceRuntimeContractOperations["paths"]>().mockReturnValue({ sourceRoot: "/source", root: "/runtime" }),
  environment: mock<SourceRuntimeContractOperations["environment"]>().mockReturnValue(Object.fromEntries([["PATH", "/bin"], ["API_KEY", "private"], ["NODE_OPTIONS", "foreign"], ["AIDLC_TIER", "foreign"]])),
  spawn: mock<SourceRuntimeContractOperations["spawn"]>().mockReturnValue({ exitCode: 0, stdout: JSON.stringify(wire), stderr: "", error: null }),
} });
