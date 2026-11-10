import { sourcePath, projectPath } from "../../kernel/values.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import type { RuntimeFile } from "../domain/neutral-surface.ts";
import type { RuntimeDataName } from "../domain/projected-file.ts";
import type { TokenBindings } from "../domain/template-token.ts";
import { bindCopiedSource } from "../domain/source-binding.ts";
import type { Rendering } from "./ports/harness.ts";
import type { RuntimeProjection } from "./ports/runtime.ts";
import { collectCommandRenderings } from "./command-renderers.ts";

const runtimeFile = (request: {
  readonly host: HostIdentity; readonly file: RuntimeFile; readonly tokens: TokenBindings;
}): Rendering => {
  const path = projectPath(`${request.host.directory}/${request.file.source}`);
  return path.ok ? accepted([{ path: path.value,
    content: bindCopiedSource({ ...request.file, tokens: request.tokens }),
    mode: "regular", availability: "always", origin: { kind: "neutral", source: request.file.source } }])
    : refused({ kind: "render-failed", concept: "host-data", name: request.file.source,
      reason: "The runtime destination must be project-relative." });
};
const runtimeData = (request: {
  readonly host: HostIdentity; readonly name: RuntimeDataName; readonly content: FileContent;
}): Rendering => {
  const name = request.name === "settings-schema" ? "aidlc-settings.schema" : request.name;
  const path = projectPath(`${request.host.directory}/tools/data/${name}.json`);
  return path.ok ? accepted([{ path: path.value, content: request.content,
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: request.name } }])
    : refused({ kind: "render-failed", concept: "host-data", name: request.name,
      reason: "The runtime data destination must be project-relative." });
};

export const projectRuntime: RuntimeProjection = (request) => {
  const version = sourcePath("tools/aidlc-version.ts");
  if (!version.ok) return refused({ kind: "render-failed", concept: "host-data", name: "aidlc-version.ts",
    reason: "The version module must have a portable source path." });
  return collectCommandRenderings([
    ...request.runtime.files.map((file) => runtimeFile({ host: request.host, file, tokens: request.tokens })),
    runtimeFile({ host: request.host, file: { source: version.value, content: request.runtime.version },
      tokens: request.tokens }),
    runtimeData({ host: request.host, name: "agent-tiers", content: request.runtime.agentTiers }),
    runtimeData({ host: request.host, name: "settings-schema", content: request.runtime.settingsSchema }),
    runtimeData({ host: request.host, name: "stage-graph",
      content: { kind: "text", text: request.compiled.graph } }),
    runtimeData({ host: request.host, name: "scope-grid",
      content: { kind: "text", text: request.compiled.grid } }),
  ]);
};
