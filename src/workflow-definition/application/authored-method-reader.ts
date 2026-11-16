import { accepted, refused } from "../../kernel/result.ts";
import type { MethodSourceReader, PluginSelectionSource, MethodContentDecoder } from "./ports.ts";
import type { CapturedPluginFiles } from "./ports.ts";
import type { PluginSelection } from "../domain/method.ts";
import type { AuthoredContent } from "./ports.ts";

export const createAuthoredMethodReader = (request: {
  readonly core: AuthoredContent;
  readonly plugins: readonly CapturedPluginFiles[];
  readonly decoder: MethodContentDecoder;
}): MethodSourceReader => ({
  readAuthored: async () => {
    const readings = await Promise.all(request.plugins.map(async (capture) => {
      const reading = await request.decoder.decodeContribution(capture);
      return reading.ok ? accepted({ ...reading.value, directory: capture.directory }) : reading;
    }));
    const issues = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
    if (issues.length > 0) return refused(issues);
    return accepted({ core: request.core.core,
      contributions: readings.flatMap((reading) => reading.ok ? [reading.value.contribution] : []),
      plugins: readings.flatMap((reading) => reading.ok
        ? [{ plugin: reading.value.contribution.plugin, directory: reading.value.directory }] : []),
      saved: [], pins: [], files: [...request.core.files,
        ...readings.flatMap((reading) => reading.ok ? reading.value.files : [])] });
  },
});

export const createPluginSelectionSource = (selection: PluginSelection): PluginSelectionSource => ({
  readSelection: async () => selection,
});
