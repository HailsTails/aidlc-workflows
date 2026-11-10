import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import type { HostSettingsRenderer, SettingsRenderingInputs } from "../../../projection/application/ports/settings.ts";
import { TEMPLATE_TOKENS } from "../../../projection/domain/template-token.ts";
import { bindTemplateTokens } from "../../../projection/domain/token-binding.ts";

export const OPENCODE_SETTINGS_INPUTS = ["opencode.json", "plugin/aidlc-opencode-adapter.ts"] as const;

const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);

const renderSettings = (inputs: SettingsRenderingInputs): Rendering => {
  const file = inputs.files.find((candidate) => candidate.source === "opencode.json");
  if (!file) return refused({ kind: "render-failed", concept: "settings", name: "opencode.json",
    reason: "The authored OpenCode settings were not captured." });
  const prepared = inputs.prepare(file);
  if (!prepared.ok) return prepared;
  const path = projectPath("opencode.json");
  return path.ok ? accepted([{ path: path.value, content: prepared.value.content,
    mode: "regular", availability: "always", origin: { kind: "harness-authored", source: file.source } }])
    : refused({ kind: "render-failed", concept: "settings", name: file.source,
      reason: "The OpenCode settings destination must be project-relative." });
};

const pluginSource = "plugin/aidlc-opencode-adapter.ts";
const entrypointMarker = "/* @aidlc-shipped-entrypoints@ */ []";
const authoredToolImport = '"../../../core/tools/aidlc-executable-path.ts"';

const renderHookRegistrations = (inputs: SettingsRenderingInputs): Rendering => {
  const file = inputs.files.find((candidate) => candidate.source === pluginSource);
  if (!file) return refused({ kind: "render-failed", concept: "hook-registration", name: pluginSource,
    reason: "The authored OpenCode hook adapter was not captured." });
  const raw = decode(file.content);
  if (!raw.includes(entrypointMarker)) return refused({ kind: "render-failed", concept: "hook-registration",
    name: pluginSource, reason: "opencode adapter is missing its shipped-entrypoint emission marker." });
  const harnessDir = inputs.tokens.HARNESS_DIR;
  if (harnessDir === null) return refused({ kind: "render-failed", concept: "hook-registration",
    name: pluginSource, reason: "The OpenCode engine directory token is required." });
  if (!raw.includes(authoredToolImport)) return refused({ kind: "render-failed", concept: "hook-registration",
    name: pluginSource, reason: "opencode adapter no longer imports aidlc-executable-path.ts from core/tools." });
  const entrypoints = JSON.stringify(inputs.entrypoints, null, 2)
    .split("\n")
    .map((line, index) => index === 0 ? line : `  ${line}`)
    .join("\n");
  const embedded = raw.replace(entrypointMarker, `/* @aidlc-shipped-entrypoints@ */ ${entrypoints}`);
  const imports = embedded.replaceAll(authoredToolImport, `"../../${harnessDir}/tools/aidlc-executable-path.ts"`);
  // This authored plugin used the emitter's complete token pass, not the
  // generic .ts preparation rule that selects invocation tokens only.
  const text = bindTemplateTokens({ text: imports, tokens: inputs.tokens, selected: TEMPLATE_TOKENS });
  const path = projectPath(`.opencode/${pluginSource}`);
  return path.ok ? accepted([{ path: path.value, content: { kind: "text", text },
    mode: "regular", availability: "always", origin: { kind: "harness-authored", source: file.source } }])
    : refused({ kind: "render-failed", concept: "hook-registration", name: pluginSource,
      reason: "The OpenCode hook destination must be project-relative." });
};

export const createOpenCodeSettingsRenderer: HostSettingsRenderer = (inputs) => ({
  renderSettings: () => renderSettings(inputs),
  renderHookRegistrations: () => renderHookRegistrations(inputs),
});
