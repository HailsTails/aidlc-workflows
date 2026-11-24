import { accepted, refused } from "../../kernel/result.ts";
import { reviewerAgentSet } from "../../workflow-definition/domain/method-participation.ts";
import type { AuthoredPluginBuild } from "../../workflow-definition/domain/authored-method.ts";
import type { PluginBuildSession, PluginBuildView, PluginSessionPorts } from "./ports/plugin-session.ts";

const projectPlugin = (ports: PluginSessionPorts, request: Parameters<PluginBuildSession["project"]>[0]) => {
  const target = ports.readTarget({ host: request.host });
  if (!target.ok) return target;
  const emitted = ports.projector.project({ plugin: request.plugin.plugin,
    pluginFolder: new URL(`${encodeURIComponent(request.plugin.directory)}/`, ports.sources),
    host: request.host, target: target.value, output: request.output,
    boundary: request.boundary, reviewerAgents: request.reviewerAgents });
  return emitted.ok ? emitted : refused([emitted.refusal]);
};

const pluginCatalogues = (ports: PluginSessionPorts, request: Parameters<PluginBuildView["catalogues"]>[0]) => {
  const readings = request.hosts.map((host) => {
    const target = ports.readTarget({ host });
    return target.ok ? accepted({ host, target: target.value }) : target;
  });
  const failures = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
  if (failures.length > 0) return refused(failures);
  const written = ports.projector.writeCatalogues({ output: request.output,
    targets: readings.flatMap((reading) => reading.ok ? [reading.value] : []) });
  return written.ok ? written : refused([written.refusal]);
};

export const createPluginBuildSession = (ports: PluginSessionPorts): PluginBuildSession => {
  let loaded: AuthoredPluginBuild | null = null;
  return {
    load: async (request) => {
      const captured = await ports.loadMethod(request);
      if (captured.ok) loaded = captured.value;
      return captured;
    },
    forBuild: () => {
      const captured = loaded;
      return captured ? accepted({
        emit: (request) => projectPlugin(ports, { ...request, reviewerAgents: reviewerAgentSet(captured.method) }),
        catalogues: (request) => pluginCatalogues(ports, request),
      }) : refused([{ kind: "render-failed", concept: "host-data", name: "plugin-build",
        reason: "Load the plugin Method before building its projections." }]);
    },
    project: (request) => projectPlugin(ports, request),
  };
};
