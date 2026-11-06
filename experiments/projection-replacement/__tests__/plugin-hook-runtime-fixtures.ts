import { createPluginHookRuntimePreparer } from "../src/adapters/plugin-hook-runtime.ts";
import type { PluginHookRuntimePreparer } from "../src/domain/plugin-hook-runtime.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";

export const runtimeCompiler: SourceBasis = { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" };
export const preparedHookReply = '{"status":"ok","inputs":[{"path":"hooks/guard.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"resources":[{"path":"hooks/guard.ts","body":"export const allowed = false;\\n"}]}';
export const hookRuntimeForReply = ({ stdout = preparedHookReply, stderr = "", exitCode = 0, error = null, compiler = runtimeCompiler }: { readonly stdout?: string; readonly stderr?: string; readonly exitCode?: number; readonly error?: string | null; readonly compiler?: SourceBasis } = {}): PluginHookRuntimePreparer => createPluginHookRuntimePreparer({
  sourceRoot: "/source", compiler,
  operations: { environment: () => ({}), spawn: () => ({ stdout, stderr, exitCode, error }) },
  directories: { allocate: async () => ({ status: "ok", value: "/private" }), remove: async () => ({ status: "ok", value: "removed" }) },
  withinDirectory: async ({ consume }) => consume({ root: "/private" }),
});
export const hookRuntimeRequest = { pluginId: "example", binding: { harness: "claude", directory: ".claude" } } as const;
