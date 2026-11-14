import { brand } from "../../kernel/brand.ts";
import type { TreeFile } from "../../kernel/file-system-port.ts";
import type { ProjectPath, SourcePath } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";
import type { HostedPluginTarget } from "./ports/plugins.ts";

export const shippedPluginTarget = ({ host, target }: HostedPluginTarget) => ({
  harnessName: host.distribution,
  manifestDir: target.manifestDir,
  marketplaceDir: target.marketplaceDir,
  hostCatalogue: target.catalogue === "written",
  harnessLeaf: host.directory,
  kind: target.format,
  installRoots: [...target.installRoots],
});

export const pluginAuthoringFiles = ({ method, targets, templates, directory }: {
  readonly method: Method;
  readonly targets: readonly HostedPluginTarget[];
  readonly templates: readonly TreeFile[];
  readonly directory: ProjectPath;
}): readonly ProjectedFile[] => {
  const table = Object.fromEntries(targets.map((target) =>
    [target.host.distribution, shippedPluginTarget(target)]));
  const agents = method.agents.filter((agent) => agent.owner.kind === "core")
    .map((agent) => agent.slug).toSorted();
  const stages = method.stages.filter((stage) => stage.owner.kind === "core")
    .map((stage) => stage.slug).toSorted();
  return [
    { path: brand<ProjectPath>(`${directory}/tools/data/plugin-targets.json`), mode: "regular",
      content: { kind: "text", text: `${JSON.stringify(table, null, 2)}\n` },
      origin: { kind: "runtime-data", name: "plugin-targets" } },
    { path: brand<ProjectPath>(`${directory}/tools/data/plugin-authoring-context.json`), mode: "regular",
      content: { kind: "text", text: `${JSON.stringify({ agents, stages }, null, 2)}\n` },
      origin: { kind: "runtime-data", name: "plugin-authoring-context" } },
    ...templates.map((template): ProjectedFile => ({
      path: brand<ProjectPath>(`${directory}/tools/data/plugin-hooks-template/${template.path}`),
      content: template.content, mode: "regular",
      origin: { kind: "neutral", source: brand<SourcePath>(`scripts/plugin-hooks-template/${template.path}`) },
    })),
  ];
};
