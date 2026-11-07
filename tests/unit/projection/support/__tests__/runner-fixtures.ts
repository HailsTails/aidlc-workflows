import type { GeneratedRunner } from "../../../../../scripts/projection/src/domain/generated-runner.ts";
import type { RunnerProcessOperations, RunnerSpawnReply, RunnerSpawnInput } from "../../../../../scripts/projection/src/adapters/runner-process.ts";
export const runnerOrigin = { source: { kind: "core", id: "framework" }, pin: "d062c81e", path: "core/tools/aidlc-runner-gen.ts" } as const;
export const runnerBinding = { harness: "claude", directory: ".claude" } as const;
export const runnerRuntime = { root: "isolated/runtime", binding: runnerBinding };
export const runnerRequest = { kind: "init" } as const;
export const runnerDecoded = { name: "aidlc-init", description: "Initialize", "generated-by": "aidlc-runner-gen", "argument-hint": "", "user-invocable": true };
export const runnerFrame = { header: "name: aidlc-init", body: "Run /aidlc", decoded: runnerDecoded };
export const runner: GeneratedRunner = { compiler: runnerOrigin, owner: { kind: "core", id: "framework" }, binding: runnerBinding, request: runnerRequest, name: "aidlc-init", description: "Initialize", markdown: "---\nname: aidlc-init\n---\nRun /aidlc", frontmatterInvocation: "unspecified" };
export const runnerFailure = { status: "invalid", findings: [{ code: "capability-gap", subject: "runner", detail: "compiler input unavailable" }] } as const;
export const createProcessFixture = ({ reply = { exitCode: 0, stdout: "[]", stderr: "", error: null } }: { readonly reply?: RunnerSpawnReply } = {}): { readonly operations: RunnerProcessOperations; readonly calls: RunnerSpawnInput[] } => {
  const calls: RunnerSpawnInput[] = [];
  return { calls, operations: {
    environment: () => Object.fromEntries([["PATH", "bin"], ["SECRET", "private"], ["AIDLC_SCOPES_DIR", "external"], ["HOME", "real-home"]]),
    paths: () => ({ root: "isolated/runtime", moduleUrl: "file:///compiler.ts", pathsUrl: "file:///paths.ts", home: "isolated/home", graph: "isolated/graph.json" }),
    spawn: (input) => { calls.push(input); return reply; },
  } };
};
