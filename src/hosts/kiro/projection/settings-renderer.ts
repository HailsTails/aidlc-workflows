import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import type { HostSettingsRenderer, SettingsRenderingInputs } from "../../../projection/application/ports/settings.ts";
import { createKiroHookRegistrations, KIRO_HOOK_REGISTRATION_INPUTS } from "./hook-registration-renderer.ts";

export const KIRO_SETTINGS_INPUTS = ["settings/cli.json", ...KIRO_HOOK_REGISTRATION_INPUTS] as const;

const renderSettings = (inputs: SettingsRenderingInputs): Rendering => {
  const file = inputs.files.find((candidate) => candidate.source === "settings/cli.json");
  if (!file) return refused({ kind: "render-failed", concept: "settings", name: "settings/cli.json",
    reason: "The authored Kiro CLI settings were not captured." });
  const prepared = inputs.prepare(file);
  if (!prepared.ok) return prepared;
  const modeled = inputs.cliModels(prepared.value);
  if (!modeled.ok) return modeled;
  const path = projectPath(".kiro/settings/cli.json");
  if (!path.ok) return refused({ kind: "render-failed", concept: "settings", name: file.source,
    reason: "The Kiro CLI settings destination must be project-relative." });
  return accepted([{ path: path.value, content: modeled.value.content, mode: "regular",
    origin: { kind: "harness-authored", source: file.source } }]);
};

export const createKiroSettingsRenderer: HostSettingsRenderer = (inputs) => ({
  renderSettings: () => renderSettings(inputs),
  renderHookRegistrations: createKiroHookRegistrations(inputs),
});
