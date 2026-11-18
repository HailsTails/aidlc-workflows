import { accepted, refused, type Result } from "../../kernel/result.ts";
import { readEveryEntry, type TreeFile } from "../../kernel/file-system-port.ts";
import type { KernelRefusal } from "../../kernel/values.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { HostedPluginTarget } from "./ports/plugins.ts";
import type { EnrichPluginAuthoring, PluginAuthoringCapture } from "./ports/plugin-authoring.ts";
import { pluginAuthoringFiles } from "./plugin-authoring-files.ts";
import { collectCommandRenderings } from "./command-renderers.ts";

const templateReading = (templates: PluginAuthoringCapture["templates"]) => {
  let captured: Promise<Result<readonly TreeFile[], readonly ProjectionRefusal[]>> | undefined;
  const read = async (): Promise<Result<readonly TreeFile[], readonly ProjectionRefusal[]>> => {
    const reading = await templates.reader.readTree({ folder: templates.folder, select: readEveryEntry });
    if (!reading.ok) return refused([{ kind: "plugin-hook-template-unreadable", within: "", code: reading.refusal.code }]);
    return reading.value.unreadable.length > 0 ? refused(reading.value.unreadable.map((failure) => ({
      kind: "plugin-hook-template-unreadable", ...failure,
    }))) : accepted(reading.value.files);
  };
  return () => captured ??= read();
};

const targetReading = (targets: PluginAuthoringCapture["targets"]) => {
  let captured: Result<readonly HostedPluginTarget[], readonly (KernelRefusal | ProjectionRefusal)[]> | undefined;
  const read = (): Result<readonly HostedPluginTarget[], readonly (KernelRefusal | ProjectionRefusal)[]> => {
    const readings = [...targets].sort((left, right) => left.host.distribution.localeCompare(right.host.distribution))
      .map((member) => {
        const target = member.read();
        return target.ok ? accepted({ host: member.host, target: target.value }) : target;
      });
    const failures = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
    return failures.length > 0 ? refused(failures)
      : accepted(readings.flatMap((reading) => reading.ok ? [reading.value] : []));
  };
  return () => captured ??= read();
};

export const createPluginAuthoringEnrichment = (ports: PluginAuthoringCapture): EnrichPluginAuthoring => {
  const templates = templateReading(ports.templates);
  const targets = targetReading(ports.targets);
  return async (request) => {
    const capturedTemplates = await templates();
    if (!capturedTemplates.ok) return capturedTemplates;
    const capturedTargets = targets();
    if (!capturedTargets.ok) return capturedTargets;
    const files = collectCommandRenderings([accepted(request.projection.files), accepted(pluginAuthoringFiles({
      method: request.method, targets: capturedTargets.value, templates: capturedTemplates.value, directory: request.directory,
    }))]);
    return files.ok ? accepted({ ...request.projection, files: files.value }) : refused([files.refusal]);
  };
};
