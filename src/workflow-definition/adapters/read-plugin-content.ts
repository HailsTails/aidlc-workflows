import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CapturedPluginFiles } from "../application/ports.ts";
import type { MarkdownOutliner, FrontmatterParser } from "../application/ports.ts";
import { pluginId, ruleId, type PluginId } from "../domain/identities.ts";
import type { ContributedContent } from "../domain/method.ts";
import type { MethodSource } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import { ruleLayerFor } from "../domain/method-rule-layer.ts";
import { decodeAuthoredContent } from "./authored-core-reader.ts";
import { authoredValue } from "./authored-markdown.ts";
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

const readPluginIdentity = (raw: string): Result<PluginId, readonly MethodRefusal[]> => {
  const identity = pluginId(raw);
  if (identity.ok) return identity;
  return identity.refusal.kind === "reserved-plugin-name"
    ? refused([{ kind: "core-namespace-claimed", plugin: identity.refusal.raw }])
    : refused([{ kind: "invalid-file", location: { kind: "plugin-manifest", plugin: raw },
      issues: ["Invalid plugin identity."] }]);
};

export const readPluginContent = async (request: { readonly capture: CapturedPluginFiles;
  readonly outliner: MarkdownOutliner; readonly parser: FrontmatterParser }):
  Promise<Result<PluginContentReading, readonly MethodRefusal[]>> => {
  const raw = manifestText({ plugin: request.capture.directory,
    content: request.capture.manifest.content });
  if (!raw.ok) return raw;
  const manifest = readPluginManifest({ plugin: request.capture.directory, raw: raw.value });
  if (!manifest.ok) return manifest;
  const identity = readPluginIdentity(manifest.value.name);
  if (!identity.ok) return identity;
  const directory = readPluginIdentity(request.capture.directory);
  if (!directory.ok) return directory;
  const decoded = decodeAuthoredContent({ files: request.capture.methodFiles,
    outliner: request.outliner, parser: request.parser, hooks: [],
    owner: { kind: "plugin", plugin: identity.value },
    ruleLayer: (path) => ruleLayerFor({ path,
      policy: { kind: "plugin", level: manifest.value.aidlc.rulesLevel ?? "team" } }) });
  if (!decoded.ok) return decoded;
  const content = { ...decoded.value.core, rules: decoded.value.core.rules.map((rule) => ({ ...rule,
    id: authoredValue(ruleId(`${identity.value}/${rule.id}`)) })) };
  const reading = { plugin: identity.value, manifest: manifest.value,
    content, files: decoded.value.files };
  return accepted(reading);
};
