import { z } from "zod";
import { harnessBindingSchema } from "./harness-binding-schema.ts";
import type { PluginHookProjectionRequest } from "../domain/plugin-hook-projection.ts";
import { finding, type Outcome } from "../domain/model.ts";
const pin = z.string().regex(/^[a-f0-9]{40}$/);
const schema = z.strictObject({ sourceRoot: z.string().min(1), sourcePin: pin, binding: harnessBindingSchema, plugin: z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9-]*$/), root: z.string().min(1), pin }), runtime: z.strictObject({ root: z.string().min(1), pin }) });
export type PluginHookInput = z.infer<typeof schema>;
export type PluginHookInputOperations = {
  readonly read: (input: { readonly path: string }) => Promise<string>;
  readonly inventory: (input: { readonly root: string }) => Promise<readonly string[]>;
};
export const createPluginHookInputOperations = (): PluginHookInputOperations => ({
  read: ({ path }) => Bun.file(path).text(),
  inventory: async ({ root }) => Array.fromAsync(new Bun.Glob("hooks/**/*").scan({ cwd: root, onlyFiles: true })),
});
export type PluginHookInputReader = {
  readonly read: (input: { readonly argv: readonly string[] }) => Promise<Outcome<{ readonly location: PluginHookInput; readonly request: PluginHookProjectionRequest }>>;
};
const parseLocation = ({ text }: { readonly text: string }): Outcome<PluginHookInput> => {
  let decoded: unknown;
  try { decoded = JSON.parse(text); } catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "plugin-hooks", detail: "hook projection request must contain valid JSON" })] }; }
  const parsed = schema.safeParse(decoded);
  return parsed.success ? { status: "ok", value: parsed.data } : { status: "invalid", findings: [finding({ code: "invalid-input", subject: "plugin-hooks", detail: "hook projection requires pinned compiler/plugin/runtime roots and an explicit harness binding" })] };
};
export const createPluginHookInputReader = ({ operations = createPluginHookInputOperations() }: { readonly operations?: PluginHookInputOperations } = {}): PluginHookInputReader => ({
  read: async ({ argv }) => {
    if (argv.length !== 1 || argv[0] === undefined) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "plugin-hooks", detail: "usage: project:hooks <request.json>; output is a native plugin contribution file on stdout" })] };
    try {
      const parsed = parseLocation({ text: await operations.read({ path: argv[0] }) });
      if (parsed.status === "invalid") return parsed;
      const location = parsed.value;
      const [text, authoredFiles, projectedFiles] = await Promise.all([
        operations.read({ path: `${location.plugin.root}/.aidlc-plugin/plugin.json` }),
        operations.inventory({ root: location.plugin.root }), operations.inventory({ root: location.runtime.root }),
      ]);
      return { status: "ok", value: { location, request: { binding: location.binding, declaration: { origin: { source: { kind: "plugin", id: location.plugin.id }, pin: location.plugin.pin, path: ".aidlc-plugin/plugin.json" }, text }, runtime: { basis: { source: { kind: "plugin", id: location.plugin.id }, pin: location.runtime.pin }, authoredFiles: authoredFiles.map((path) => path.replaceAll("\\", "/")), projectedFiles: projectedFiles.map((path) => path.replaceAll("\\", "/")) } } } };
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "plugin-hooks", detail: `hook projection inputs unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
