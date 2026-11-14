import { HOSTS } from "./host-table.ts";
import type { PluginProjector } from "../projection/application/ports/plugins.ts";
import type { MarkdownOutliner } from "../workflow-definition/application/ports.ts";
import type { CreatePackageBuildRoot, ExitStatus, PackageBuildRoot, Platform } from "./roots.ts";
import type { ResolveModelCap } from "../projection/domain/model-cap.ts";

type MainComposition = {
  readonly workingDirectory: URL;
  readonly outliner: MarkdownOutliner;
  readonly createNodeFileSystem: () => Platform["fileSystem"];
  readonly createNodeProcessRunner: () => Platform["processRunner"];
  readonly createBunYamlParser: () => Platform["yaml"];
  readonly createBunContentDigester: () => Platform["digester"];
  readonly createProcessTerminal: () => Platform["terminal"];
  readonly createPluginProjector: (request: { hookTemplates: URL }) => PluginProjector;
  readonly createPackageBuildRoot: CreatePackageBuildRoot;
};

export const openPackageBuildRoot = (composition: MainComposition): PackageBuildRoot => {
  const sources = { core: new URL("../../core/", import.meta.url), plugins: new URL("../../plugins/", import.meta.url),
    pluginHookTemplates: new URL("../../scripts/plugin-hooks-template/", import.meta.url) };
  const platform: Platform = {
    fileSystem: composition.createNodeFileSystem(),
    processRunner: composition.createNodeProcessRunner(),
    yaml: composition.createBunYamlParser(),
    digester: composition.createBunContentDigester(),
    terminal: composition.createProcessTerminal(),
  };
  return composition.createPackageBuildRoot({ hosts: HOSTS,
    workingDirectory: composition.workingDirectory,
    platform, outliner: composition.outliner,
    sources, plugins: composition.createPluginProjector({ hookTemplates: sources.pluginHookTemplates }),
    runnerFrames: new URL("../../.cache/runner-frames/", import.meta.url),
  });
};

export const runPackageCommand = async ({ argv, composition, resolveModelCap }: {
  readonly argv: readonly string[];
  readonly composition: MainComposition;
  readonly resolveModelCap: ResolveModelCap;
}): Promise<ExitStatus> => {
  const root = openPackageBuildRoot(composition);
  const route = root.buildRoutes({ resolveModelCap })
    .filter((candidate) => candidate.verb.every((word, index) => word === argv[index]))
    .toSorted((first, second) => second.verb.length - first.verb.length)[0];
  return route ? route.run(argv.slice(route.verb.length)) : 2;
};
