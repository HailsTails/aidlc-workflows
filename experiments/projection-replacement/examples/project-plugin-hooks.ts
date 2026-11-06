import { createPluginHookInputReader, type PluginHookInputReader } from "../src/adapters/plugin-hook-input.ts";
import { createPluginHookProjector } from "../src/adapters/plugin-hook-projector.ts";
import type { PluginHookProjector } from "../src/domain/plugin-hook-projection.ts";
export type PluginHookCommandDependencies = {
  readonly reader: PluginHookInputReader;
  readonly projector: typeof createPluginHookProjector;
  readonly stdout: (input: { readonly text: string }) => void;
  readonly failure: (input: { readonly text: string }) => void;
};
export const createPluginHookCommandDependencies = (): PluginHookCommandDependencies => ({
  reader: createPluginHookInputReader(), projector: createPluginHookProjector,
  stdout: ({ text }) => { process.stdout.write(text); },
  failure: ({ text }) => { process.stderr.write(text); process.exitCode = 1; },
});
export const projectPluginHooks = async ({ argv, dependencies = createPluginHookCommandDependencies() }: { readonly argv: readonly string[]; readonly dependencies?: PluginHookCommandDependencies }): Promise<void> => {
  const loaded = await dependencies.reader.read({ argv });
  if (loaded.status === "invalid") return dependencies.failure({ text: JSON.stringify(loaded) + "\n" });
  const { location, request } = loaded.value;
  const projector: PluginHookProjector = dependencies.projector({ sourceRoot: location.sourceRoot, compiler: { source: { kind: "core", id: "framework" }, pin: location.sourcePin } });
  const projected = await projector.project(request);
  if (projected.status === "invalid") return dependencies.failure({ text: JSON.stringify(projected) + "\n" });
  dependencies.stdout({ text: projected.value.resources[0].body });
};
if (import.meta.main) await projectPluginHooks({ argv: Bun.argv.slice(2) });
