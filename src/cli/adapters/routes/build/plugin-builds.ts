import { accepted, type Result } from "../../../../kernel/result.ts";
import type { HostIdentity } from "../../../../kernel/host.ts";
import type { KernelRefusal } from "../../../../kernel/values.ts";
import type { Terminal } from "../../../../kernel/terminal-port.ts";
import type { ProjectionRefusal } from "../../../../projection/domain/projection.ts";
import type { BuildPlugins, PluginsBuildRequest } from "../../../roots.ts";

type BuildFailure = readonly (KernelRefusal | ProjectionRefusal)[];
type PluginBuild = {
  readonly plugin: PluginsBuildRequest["plugins"][number]; readonly host: HostIdentity;
  readonly output: URL; readonly boundary: URL;
};

export const createPluginBuilds = (ports: {
  readonly emit: (request: PluginBuild) => Result<URL, BuildFailure>;
  readonly catalogues: (request: { readonly output: URL; readonly hosts: readonly HostIdentity[] }) =>
    Result<readonly string[], BuildFailure>;
  readonly terminal: Terminal;
}): BuildPlugins => (request) => {
  const builds = request.plugins.flatMap((plugin) => request.hosts.map((host) => ({ plugin, host,
    output: new URL(`plugins/${encodeURIComponent(plugin.directory)}/${host.distribution}/`, request.output),
    boundary: request.boundary })));
  const emitted = builds.reduce<Result<readonly URL[], BuildFailure>>((previous, build) => {
    if (!previous.ok) return previous;
    const emission = ports.emit(build);
    if (!emission.ok) return emission;
    ports.terminal.write(`[plugin:${build.plugin.directory}] emitted dist/plugins/${build.plugin.directory}/${build.host.distribution}/\n`);
    return accepted([...previous.value, emission.value]);
  }, accepted([]));
  if (!emitted.ok) return emitted;
  const catalogues = ports.catalogues({ output: new URL("plugins/", request.output), hosts: request.hosts });
  if (!catalogues.ok) return catalogues;
  catalogues.value.forEach((file) => { ports.terminal.write(`[plugins] emitted dist/plugins/${file}\n`); });
  return accepted({ emitted: emitted.value, catalogues: catalogues.value });
};
