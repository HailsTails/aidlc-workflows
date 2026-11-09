import type { MarkdownOutliner } from "../workflow-definition/application/ports.ts";
import type { CreatePackageBuildRoot, PackageBuildRoot, Platform } from "./roots.ts";

type MainComposition = {
  readonly outliner: MarkdownOutliner;
  readonly createNodeFileSystem: () => Platform["fileSystem"];
  readonly createNodeProcessRunner: () => Platform["processRunner"];
  readonly createBunYamlParser: () => Platform["yaml"];
  readonly createPackageBuildRoot: CreatePackageBuildRoot;
};

export const openPackageBuildRoot = (composition: MainComposition): PackageBuildRoot => {
  const platform: Platform = {
    fileSystem: composition.createNodeFileSystem(),
    processRunner: composition.createNodeProcessRunner(),
    yaml: composition.createBunYamlParser(),
  };
  return composition.createPackageBuildRoot({ platform, outliner: composition.outliner,
    sources: { core: new URL("../../core/", import.meta.url), plugins: new URL("../../plugins/", import.meta.url) },
    runnerFrames: new URL("../../.cache/runner-frames/", import.meta.url),
  });
};
