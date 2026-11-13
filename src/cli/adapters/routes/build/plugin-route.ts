import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { accepted, refused, type Result } from "../../../../kernel/result.ts";
import type { Terminal } from "../../../../kernel/terminal-port.ts";
import type { HostIdentity } from "../../../../kernel/host.ts";
import { pluginId } from "../../../../workflow-definition/domain/identities.ts";
import { reviewerAgentSet } from "../../../../workflow-definition/domain/method-participation.ts";
import type { CommandRoute, ExitStatus, PackageBuildRoot } from "../../../roots.ts";

type LoadedPlugins = Extract<Awaited<ReturnType<PackageBuildRoot["loadPlugins"]>>, { readonly ok: true }>["value"];
type LoadedPlugin = LoadedPlugins["plugins"][number];

const usage = "usage: package.ts plugin build <plugin> <harness> <outDir>";
const argumentsOf = (argv: readonly string[]): Result<{
  readonly plugin: string; readonly harness: string; readonly output: string;
}, string> => {
  const [plugin, harness, output, ...extra] = argv;
  return !plugin || !harness || !output || extra.length > 0 || argv.some((word) => word.startsWith("-"))
    ? refused(usage) : accepted({ plugin, harness, output });
};

const admittedName = (name: string): Result<string, string> => {
  const identity = pluginId(name);
  return identity.ok ? accepted(name) : refused(identity.refusal.kind === "reserved-plugin-name"
    ? `plugin name "${identity.refusal.raw}" is reserved; choose a non-reserved plugin name.`
    : `invalid plugin name "${identity.refusal.raw}"; use a lowercase kebab-case name.`);
};

const selectedPlugin = (catalogue: LoadedPlugins, name: string): Result<LoadedPlugin, string> => {
  const plugin = catalogue.plugins.find((entry) => entry.directory === name);
  return plugin ? accepted(plugin) : refused(`unknown plugin "${name}" (have: ${catalogue.plugins
    .map((entry) => entry.directory).join(", ") || "none"})`);
};

const pluginCatalogue = async (root: Pick<PackageBuildRoot, "loadCore" | "loadPlugins">):
  Promise<Result<LoadedPlugins, string>> => {
  const core = await root.loadCore();
  if (!core.ok) return refused(JSON.stringify(core.refusal));
  const plugins = await root.loadPlugins({ core: core.value });
  return plugins.ok ? plugins : refused(JSON.stringify(plugins.refusal));
};

const failed = (terminal: Terminal, reason: string): ExitStatus => {
  terminal.writeError(`${reason}\n`);
  return 1;
};

type PluginRoutePorts = {
  readonly root: Pick<PackageBuildRoot, "loadCore" | "loadPlugins">;
  readonly hosts: readonly HostIdentity[];
  readonly emit: (request: { readonly plugin: LoadedPlugin; readonly host: HostIdentity;
    readonly output: URL; readonly reviewerAgents: ReadonlySet<string> }) => Result<void, string>;
  readonly workingDirectory: URL; readonly terminal: Terminal;
};

const emitSelected = ({ ports, args, catalogue }: { readonly ports: PluginRoutePorts; readonly args: {
  readonly plugin: string; readonly harness: string; readonly output: string;
}; readonly catalogue: LoadedPlugins }): Result<void, string> => {
  const selected = selectedPlugin(catalogue, args.plugin);
  if (!selected.ok) return selected;
  const host = ports.hosts.find((candidate) => candidate.distribution === args.harness);
  if (!host) return refused(
    `unknown plugin harness "${args.harness}" (have: ${ports.hosts.map((candidate) => candidate.distribution).toSorted().join(", ")})`);
  const outputArg = args.output.replace(/[/\\]+$/, "") || args.output;
  const output = pathToFileURL(resolve(fileURLToPath(ports.workingDirectory), outputArg));
  return ports.emit({ plugin: selected.value, host, output, reviewerAgents: reviewerAgentSet(catalogue.method) });
};

export const createPluginBuildRoute = (ports: PluginRoutePorts): CommandRoute => ({
  verb: ["plugin", "build"],
  run: async (argv) => {
    const args = argumentsOf(argv);
    if (!args.ok) return failed(ports.terminal, args.refusal);
    const identity = admittedName(args.value.plugin);
    if (!identity.ok) return failed(ports.terminal, identity.refusal);
    const catalogue = await pluginCatalogue(ports.root);
    if (!catalogue.ok) return failed(ports.terminal, catalogue.refusal);
    const emitted = emitSelected({ ports, args: args.value, catalogue: catalogue.value });
    return emitted.ok ? 0 : failed(ports.terminal, emitted.refusal);
  },
});
