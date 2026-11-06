import { mock } from "bun:test";
import { distributionBasis } from "./distribution-fixtures.ts";
import { stageOrigin } from "./stage-fixtures.ts";
export const nativeStageSource = "---\nslug: code-generation\nmode: subagent\nreviewer: aidlc-architecture-reviewer-agent\n---\n# Code generation\nPreserve plan approval. Run aidlc doctor and read .claude/rules/testing.md.\n";
export const nativeStageDocument = { path: ".claude/aidlc-common/stages/construction/code-generation.md", source: nativeStageSource, text: nativeStageSource };
export const nativeStageInputs = [
  { path: "scripts/native-command-text.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "scripts/native-command-context.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/tools/aidlc-command.ts", sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" },
  { path: "core/tools/aidlc-routes.ts", sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" },
  { path: "core/tools/aidlc-color.ts", sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" },
];
export const nativeStageOrigins = nativeStageInputs.map((input) => ({ ...distributionBasis, path: input.path }));
export const nativeStageCommands = { binding: { harness: "claude", directory: ".claude" }, compiler: { ...distributionBasis, path: "scripts/native-command-text.ts" }, inputs: nativeStageInputs, documents: [{ ...nativeStageDocument, origins: nativeStageOrigins }] } as const;
export const nativeStageRequest = { sourceRoot: "authored", basis: distributionBasis, binding: nativeStageCommands.binding, documents: [{ path: nativeStageDocument.path, source: nativeStageSource }] };
export const nativeStageReply = { status: "ok", documents: [nativeStageDocument], inputs: nativeStageInputs };
export const dispatcherStageReply = { ...nativeStageReply, inputs: nativeStageInputs.map((input) => input.path === "core/tools/aidlc-routes.ts" ? { ...input, path: "core/tools/aidlc.ts" } : input) };
export const nativeStageEnvironment = Object.fromEntries([["PATH", "bin"], ["API_KEY", "private"]]);
export const nativeStageExpectedEnvironment = Object.fromEntries([["PATH", "bin"], ["AIDLC_HARNESS_DIR", ".claude"]]);
export const nativeStageForbiddenEnvironment = Object.fromEntries([["API_KEY", "private"]]);
export const createNativeStageOperations = ({ reply = nativeStageReply, transport = {} }: { readonly reply?: unknown; readonly transport?: { readonly exitCode?: number; readonly stderr?: string; readonly error?: string | null; readonly stdout?: string } } = {}) => ({ environment: mock().mockReturnValue(nativeStageEnvironment), spawn: mock().mockReturnValue({ exitCode: 0, stderr: "", error: null, stdout: JSON.stringify(reply), ...transport }) });
export const nativeStageProjection = { origin: stageOrigin, authoring: nativeStageOrigins, slug: "code-generation", phase: "construction", harness: "claude", resources: [{ kind: "file", path: nativeStageDocument.path, body: nativeStageSource }] } as const;
