import type { MethodSourceReader, PluginSelectionSource } from "./ports.ts";
import type { CompileMethod, LoadMethod } from "./use-cases.ts";

export const createMethodLoader = (request: {
  readonly reader: MethodSourceReader;
  readonly selection: PluginSelectionSource;
  readonly compiler: CompileMethod;
}): LoadMethod => ({
  loadAuthored: async () => {
    const sources = await request.reader.readAuthored();
    if (!sources.ok) return sources;
    const selection = await request.selection.readSelection();
    return request.compiler.compile({ core: sources.value.core, contributions: sources.value.contributions,
      saved: sources.value.saved, pins: sources.value.pins, selection });
  },
});
