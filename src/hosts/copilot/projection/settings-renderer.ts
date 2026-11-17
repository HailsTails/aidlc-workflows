import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { HostSettingsRenderer, SettingsRenderingInputs } from "../../../projection/application/ports/settings.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import { bindTemplateTokens } from "../../../projection/domain/token-binding.ts";
import { HOOK_WIRING } from "./hook-wiring.ts";
import { copilotEngineLauncher } from "./launcher.ts";

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
    path: path.value, mode: "regular",
    content: { kind: "text", text: `${JSON.stringify({ version: 1, hooks }, null, 2)}\n` },
    origin: { kind: "rendered", concept: "hook-registration", name: "aidlc.json" },
  }]) : refused({ kind: "render-failed", concept: "hook-registration", name: "aidlc.json",
    reason: "The Copilot hook destination must be project-relative." });
};

const renderLauncher = (inputs: SettingsRenderingInputs): Rendering => {
  const path = projectPath(copilotEngineLauncher.path);
  const text = bindTemplateTokens({ text: copilotEngineLauncher.body({ invocation: "{{INVOKE}}" }),
    tokens: inputs.tokens, selected: ["INVOKE"] });
  return path.ok ? accepted([{
    path: path.value, mode: "executable", content: { kind: "text", text },
    origin: { kind: "rendered", concept: "hook-registration", name: "aidlc-engine" },
  }]) : refused({ kind: "render-failed", concept: "hook-registration", name: "aidlc-engine",
    reason: "The Copilot engine launcher destination must be project-relative." });
};

const renderHookSurface = (inputs: SettingsRenderingInputs): Rendering => {
  const hooks = renderHooks(inputs);
  if (!hooks.ok) return hooks;
  const launcher = renderLauncher(inputs);
  return launcher.ok ? accepted([...hooks.value, ...launcher.value]) : launcher;
};

export const createCopilotSettingsRenderer: HostSettingsRenderer = (inputs) => ({
  renderSettings: () => accepted([]),
  renderHookRegistrations: () => renderHookSurface(inputs),
});
