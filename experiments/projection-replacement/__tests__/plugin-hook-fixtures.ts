import type { PluginHookProjectionRequest, PluginHookProjector, PluginHookProjection } from "../src/domain/plugin-hook-projection.ts";
import { createPluginHookProjector } from "../src/adapters/plugin-hook-projector.ts";
import type { PluginHookInputOperations, PluginHookInput } from "../src/adapters/plugin-hook-input.ts";
import type { Outcome } from "../src/domain/model.ts";
import type { PluginHookCommandDependencies } from "../examples/project-plugin-hooks.ts";

export const emptyHookFile = '{\n  "schemaVersion": 1,\n  "pluginName": "example",\n  "harness": "claude",\n  "registrations": []\n}\n';
export const emptyHookReply = '{"status":"ok","projection":{"schemaVersion":1,"pluginName":"example","harness":"claude","registrations":[]}}';
export const hookRequest: PluginHookProjectionRequest = {
  binding: { harness: "claude", directory: ".claude" },
  declaration: { origin: { source: { kind: "plugin", id: "example" }, pin: "author-pin", path: "plugins/example/.aidlc-plugin/plugin.json" }, text: '{"name":"example"}' },
  runtime: { basis: { source: { kind: "plugin", id: "example" }, pin: "author-pin" }, authoredFiles: [], projectedFiles: [] },
};
export const projectorForReply = ({ stdout = emptyHookReply, stderr = "", exitCode = 0, error = null }: { readonly stdout?: string; readonly stderr?: string; readonly exitCode?: number; readonly error?: string | null } = {}): PluginHookProjector => createPluginHookProjector({
  sourceRoot: "/source", compiler: { source: { kind: "core", id: "framework" }, pin: "compiler-pin" },
  operations: { environment: () => ({}), spawn: () => ({ stdout, stderr, exitCode, error }) },
  directories: { allocate: async () => ({ status: "ok", value: "/private" }), remove: async () => ({ status: "ok", value: "removed" }) },
});
export const hookInputOperations: PluginHookInputOperations = {
  read: async ({ path }) => path === "request.json"
    ? '{"sourceRoot":"/source","sourcePin":"1111111111111111111111111111111111111111","binding":{"harness":"claude","directory":".claude"},"plugin":{"id":"example","root":"/plugin","pin":"2222222222222222222222222222222222222222"},"runtime":{"root":"/runtime","pin":"3333333333333333333333333333333333333333"}}'
    : '{"name":"example"}',
  inventory: async ({ root }) => root === "/plugin" ? ["hooks\\guard.ts"] : ["hooks\\guard.ts", "hooks\\helper.ts"],
};
type HookCommandInput = Outcome<{ readonly location: PluginHookInput; readonly request: PluginHookProjectionRequest }>;
const loadedHookInput: HookCommandInput = { status: "ok", value: {
  location: { sourceRoot: "/source", sourcePin: "compiler-pin", binding: { harness: "claude", directory: ".claude" }, plugin: { id: "example", root: "/plugin", pin: "author-pin" }, runtime: { root: "/runtime", pin: "author-pin" } }, request: hookRequest,
} };
const projectedHook: Outcome<PluginHookProjection> = { status: "ok", value: {
  owner: { source: { kind: "plugin", id: "example" }, pin: "author-pin" }, declaration: hookRequest.declaration.origin,
  compiler: { source: { kind: "core", id: "framework" }, pin: "compiler-pin", path: "core/projection/plugin-hook.ts" }, runtime: hookRequest.runtime.basis,
  binding: { harness: "claude", directory: ".claude" }, registrations: 0, resources: [{ kind: "file", path: "contributions/hook-registrations.json", body: emptyHookFile }],
} };
export type HookCommandFixture = { readonly dependencies: PluginHookCommandDependencies; readonly output: { readonly stdout: readonly string[]; readonly errors: readonly string[] } };
export const hookCommandFixture = ({ loaded = loadedHookInput, projected = projectedHook }: { readonly loaded?: HookCommandInput; readonly projected?: Outcome<PluginHookProjection> } = {}): HookCommandFixture => {
  const stdout: string[] = [], errors: string[] = [];
  return { output: { stdout, errors }, dependencies: {
    reader: { read: async () => loaded }, projector: () => ({ project: async () => projected }),
    stdout: ({ text }) => { stdout.push(text); }, failure: ({ text }) => { errors.push(text); },
  } };
};
