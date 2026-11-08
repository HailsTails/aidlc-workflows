import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { MethodSourceReader, MethodSources, PluginSelectionSource } from "../application/ports.ts";
import type { MarkdownOutliner } from "../application/ports.ts";
import type { CapturedPluginFiles } from "../application/source-files.ts";
import type { PluginId } from "../domain/identities.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { PluginSelection } from "../domain/method.ts";
import type { AuthoredContent } from "./authored-core-reader.ts";
import { readContribution } from "./read-contribution.ts";

export type PluginBuildTarget = { readonly plugin: PluginId; readonly directory: string };
type AuthoredRepositorySources = MethodSources & {
  readonly pluginDirectories: readonly PluginBuildTarget[];
};
interface AuthoredRepositoryReader extends Pick<MethodSourceReader, "readAuthored"> {
  readAuthored(): Promise<Result<AuthoredRepositorySources, readonly MethodRefusal[]>>;
}

export const createAuthoredMethodReader = (request: {
  readonly core: AuthoredContent;
  readonly plugins: readonly CapturedPluginFiles[];
  readonly outliner: MarkdownOutliner;
}): AuthoredRepositoryReader => ({
  readAuthored: async () => {
    const readings = await Promise.all(request.plugins.map(async (capture) => {
      const reading = await readContribution({ capture, outliner: request.outliner });
      return reading.ok ? accepted({ ...reading.value, directory: capture.directory }) : reading;
    }));
    const issues = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
    if (issues.length > 0) return refused(issues);
    return accepted({ core: request.core.core,
      contributions: readings.flatMap((reading) => reading.ok ? [reading.value.contribution] : []),
      pluginDirectories: readings.flatMap((reading) => reading.ok
        ? [{ plugin: reading.value.contribution.plugin, directory: reading.value.directory }] : []),
      saved: [], pins: [], files: [...request.core.files,
        ...readings.flatMap((reading) => reading.ok ? reading.value.files : [])] });
  },
});

export const createPluginSelectionSource = (selection: PluginSelection): PluginSelectionSource => ({
  readSelection: async () => selection,
});
