import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { HostSettingsRenderer, SettingsRenderingInputs } from "../../../projection/application/ports/settings.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import { HOOK_WIRING } from "./hook-wiring.ts";

export const COPILOT_SETTINGS_INPUTS = [] as const;

const renderHooks = (inputs: SettingsRenderingInputs): Rendering => {
  const seconds = inputs.extendedSubprocessTimeoutMs / 1000;
  const hooks = Object.fromEntries(HOOK_WIRING.map(({ event, target, timeoutMultiplier }) => {
    const command = `bun ${inputs.tokens["HARNESS_DIR"]}/hooks/aidlc-copilot-adapter.ts ${target}`;
    return [event, [{ type: "command", bash: command, powershell: command,
      timeoutSec: seconds * timeoutMultiplier }]];
  }));
  const path = projectPath(".github/hooks/aidlc.json");
  return path.ok ? accepted([{
    path: path.value, mode: "regular", availability: "always",
    content: { kind: "text", text: `${JSON.stringify({ version: 1, hooks }, null, 2)}\n` },
    origin: { kind: "rendered", concept: "hook-registration", name: "aidlc.json" },
  }]) : refused({ kind: "render-failed", concept: "hook-registration", name: "aidlc.json",
    reason: "The Copilot hook destination must be project-relative." });
};

export const createCopilotSettingsRenderer: HostSettingsRenderer = (inputs) => ({
  renderSettings: () => accepted([]),
  renderHookRegistrations: () => renderHooks(inputs),
});
