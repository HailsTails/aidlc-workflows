import { buildPluginProjection, writeFirstPartyCatalogues, type PluginTarget, type PluginTargetKind }
  from "../../../core/tools/aidlc-plugin-emit.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { asFolder } from "../../kernel/file-system-port.ts";
import { shippedPluginTarget } from "../application/plugin-authoring-files.ts";
import type { HostedPluginTarget, PluginProjector } from "../application/ports/plugins.ts";

const EMITTER_KINDS = ["store", "kiro", "kiro-ide", "cursor"] as const satisfies readonly PluginTargetKind[];

const isEmitterKind = (format: string): format is PluginTargetKind =>
  EMITTER_KINDS.some((kind) => kind === format);

const targetForEmitter = (target: HostedPluginTarget): PluginTarget => {
  const row = shippedPluginTarget(target);
  if (!isEmitterKind(row.kind)) throw new Error(`The shipped plugin emitter has no ${row.kind} target.`);
  return { ...row, kind: row.kind };
};

const reasonOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const createLegacyPluginProjector = ({ hookTemplates }: {
  readonly hookTemplates: URL;
}): PluginProjector => ({
  project: (request) => {
    try {
      buildPluginProjection({ pluginRoot: Bun.fileURLToPath(request.pluginFolder),
        target: targetForEmitter(request), outDir: Bun.fileURLToPath(request.output),
        outputBoundary: Bun.fileURLToPath(request.boundary), templateHooksDir: Bun.fileURLToPath(hookTemplates),
        reviewerAgents: request.reviewerAgents, firstParty: true });
      return accepted(asFolder(request.output));
    } catch (error) {
      return refused({ kind: "plugin-emit-failed", plugin: request.plugin,
        host: request.host.distribution, reason: reasonOf(error) });
    }
  },
  writeCatalogues: (request) => {
    try {
      return accepted(writeFirstPartyCatalogues(Bun.fileURLToPath(request.output), request.targets.map(targetForEmitter)));
    } catch (error) {
      return refused({ kind: "render-failed", concept: "host-data", name: "plugin-catalogues", reason: reasonOf(error) });
    }
  },
});
