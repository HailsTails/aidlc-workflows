import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath } from "../../kernel/values.ts";
import type { CapturedPluginFiles, SourceFiles } from "../application/source-files.ts";
import type { MarkdownOutliner } from "../application/ports.ts";
import type { RuleLevel } from "../domain/contribution.ts";
import { pluginId, ruleId, type PluginId } from "../domain/identities.ts";
import type { ContributedContent } from "../domain/method.ts";
import type { MethodSource } from "../domain/method-source.ts";
import { pluginNamespaceIssues } from "../domain/plugin-selection.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { RuleLayer } from "../domain/rule.ts";
import { PHASES } from "../domain/vocabulary.ts";
import { readAuthoredContent } from "./authored-core-reader.ts";
import { authoredValue } from "./authored-markdown.ts";
import { capturedSourceFiles } from "./captured-source-files.ts";
import { readPluginManifest, type PluginManifestFile } from "./plugin-files.ts";

export type PluginContentReading = {
  readonly plugin: PluginId;
  readonly manifest: PluginManifestFile;
  readonly content: ContributedContent;
  readonly files: readonly MethodSource[];
};

const manifestText = (request: { readonly plugin: string; readonly content: FileContent }):
  Result<string, readonly MethodRefusal[]> => {
  try {
    return accepted(request.content.kind === "text" ? request.content.text
      : new TextDecoder("utf-8", { fatal: true }).decode(request.content.bytes));
  } catch {
    return refused([{ kind: "invalid-file", location: { kind: "plugin-manifest",
      plugin: request.plugin }, issues: ["Plugin manifest must contain valid UTF-8."] }]);
  }
};

const layerFor = (path: string, level: RuleLevel): RuleLayer => {
  const phase = PHASES.find((candidate) => path === `memory/phases/${candidate}.md`);
  return phase ? { kind: "phase", phase } : { kind: level };
};

const pluginContentFiles = (capture: CapturedPluginFiles): SourceFiles => {
  const files = capturedSourceFiles(capture.files);
  return { read: (directory) => files.read(directory === "aidlc-common/stages"
    ? authoredValue(sourcePath("stages")) : directory) };
};

export const readPluginContent = async (request: { readonly capture: CapturedPluginFiles;
  readonly outliner: MarkdownOutliner }):
  Promise<Result<PluginContentReading, readonly MethodRefusal[]>> => {
  const raw = manifestText({ plugin: request.capture.directory,
    content: request.capture.manifest.content });
  if (!raw.ok) return raw;
  const manifest = readPluginManifest({ plugin: request.capture.directory, raw: raw.value });
  if (!manifest.ok) return manifest;
  const namespace = [...new Set([manifest.value.name, request.capture.directory])]
    .flatMap(pluginNamespaceIssues);
  if (namespace.length > 0) return refused(namespace);
  const identity = pluginId(manifest.value.name);
  if (!identity.ok) return refused([{ kind: "invalid-file", location: {
    kind: "plugin-manifest", plugin: request.capture.directory },
  issues: ["Invalid plugin identity."] }]);
  const decoded = await readAuthoredContent({ sourceFiles: pluginContentFiles(request.capture),
    outliner: request.outliner, hooks: [], owner: { kind: "plugin", plugin: identity.value },
    ruleLayer: (path) => layerFor(path, manifest.value.aidlc.rulesLevel ?? "team") });
  if (!decoded.ok) return decoded;
  const content = { ...decoded.value.core, rules: decoded.value.core.rules.map((rule) => ({ ...rule,
    id: authoredValue(ruleId(`${identity.value}/${rule.id}`)) })) };
  const reading = { plugin: identity.value, manifest: manifest.value,
    content, files: decoded.value.files };
  return accepted(reading);
};
