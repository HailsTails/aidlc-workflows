import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath } from "../../kernel/values.ts";
import type { MarkdownOutliner, FrontmatterParser, ContributionReading } from "../application/ports.ts";
import type { CapturedPluginFiles } from "../application/ports.ts";
import type { Contribution, ContributionDependency } from "../domain/contribution.ts";
import { pluginId } from "../domain/identities.ts";
import { methodSourcePath } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import { authoredValue, translated } from "./authored-markdown.ts";
import { readOverlay } from "./read-overlay.ts";
import { readPluginContent, type PluginContentReading } from "./read-plugin-content.ts";

const toolsOf = (request: { readonly capture: CapturedPluginFiles;
  readonly reading: PluginContentReading }): Contribution["tools"] => {
  const scripts = request.capture.files.filter((file) =>
    file.within.startsWith("tools/") && file.within.endsWith(".ts")).map((file) => file.within);
  return { scripts, doctorCheck: scripts.find((path) => path === `tools/${request.reading.plugin}-doctor.ts`) ?? null,
    commands: Object.entries(request.reading.manifest.aidlc.commands ?? {}).map(([name, command]) => ({
      name, script: authoredValue(sourcePath(command.script)), description: command.description,
    })) };
};

const dependenciesOf = (reading: PluginContentReading):
  Result<readonly ContributionDependency[], readonly MethodRefusal[]> => {
  const dependencies = reading.manifest.dependencies.map((dependency) => {
    if (dependency === "core") return accepted<ContributionDependency>({ kind: "core" });
    const plugin = pluginId(dependency);
    return plugin.ok ? accepted<ContributionDependency>({ kind: "plugin", plugin: plugin.value })
      : refused([{ kind: "invalid-file" as const, location: { kind: "plugin-manifest" as const,
        plugin: reading.plugin }, issues: [`Invalid plugin dependency: ${dependency}`] }]);
  });
  const issues = dependencies.flatMap((dependency) => dependency.ok ? [] : dependency.refusal);
  return issues.length > 0 ? refused(issues)
    : accepted(dependencies.flatMap((dependency) => dependency.ok ? [dependency.value] : []));
};

export const readContribution = async (request: { readonly capture: CapturedPluginFiles;
  readonly outliner: MarkdownOutliner; readonly parser: FrontmatterParser }):
  Promise<Result<ContributionReading, readonly MethodRefusal[]>> => {
  const reading = await readPluginContent(request);
  if (!reading.ok) return reading;
  const owner = { kind: "plugin" as const, plugin: reading.value.plugin };
  const overlays = request.capture.files.filter((file) =>
    file.within.startsWith("contributions/") && file.within.endsWith(".md")).map((file) => {
    const source = { owner, path: authoredValue(methodSourcePath({ kind: "overlay",
      within: file.within.slice("contributions/".length) })) };
    const raw = translated(source, () => file.content.kind === "text" ? file.content.text
      : new TextDecoder("utf-8", { fatal: true }).decode(file.content.bytes));
    if (!raw.ok) return raw;
    const overlay = readOverlay({ source, raw: raw.value, outliner: request.outliner, parser: request.parser });
    return overlay.ok ? accepted({ overlay: overlay.value,
      file: { ...source, content: file.content } }) : overlay;
  });
  const issues = overlays.flatMap((overlay) => overlay.ok ? [] : overlay.refusal);
  if (issues.length > 0) return refused(issues);
  const dependencies = dependenciesOf(reading.value);
  if (!dependencies.ok) return dependencies;
  return accepted({ contribution: {
    plugin: reading.value.plugin, version: reading.value.manifest.version,
    description: reading.value.manifest.description, dependsOn: dependencies.value,
    rulesLevel: reading.value.manifest.aidlc.rulesLevel ?? "team", content: reading.value.content,
    overlays: overlays.flatMap((overlay) => overlay.ok ? [overlay.value.overlay] : []),
    tools: toolsOf({ capture: request.capture, reading: reading.value }),
  }, files: [...reading.value.files,
    ...overlays.flatMap((overlay) => overlay.ok ? [overlay.value.file] : [])] });
};
