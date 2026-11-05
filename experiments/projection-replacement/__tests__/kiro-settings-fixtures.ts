import type { AgentOrigin } from "../src/domain/agent-definition.ts";
import type { KiroCliSettings } from "../src/adapters/kiro-cli-settings.ts";
import type { KiroModelPlan, KiroModelRequest } from "../src/domain/kiro-model-defaults.ts";

export const settingsOrigin: AgentOrigin = { source: { kind: "core", id: "framework" }, pin: "d062c81e", path: "harness/kiro/settings/cli.json" };
export const plainSettingsText = '{"chat.defaultAgent":"aidlc"}';
export const plainSettings: KiroCliSettings = { origin: settingsOrigin, fields: { "chat.defaultAgent": "aidlc" }, current: {}, models: {} };
export const highRequest: KiroModelRequest = { origin: settingsOrigin, agent: "aidlc-quality-agent", model: "claude-sonnet-4.6", effort: "high" };
export const highPlan: KiroModelPlan = { origin: settingsOrigin, baseline: {}, updates: { "claude-sonnet-4.6": "high" }, resolutions: [{ agent: "aidlc-quality-agent", model: "claude-sonnet-4.6", requested: "high", applied: "high" }] };
export const emptyPlan: KiroModelPlan = { origin: settingsOrigin, baseline: {}, updates: {}, resolutions: [] };
const outputKey = "output_config";
export const preservedSettings: KiroCliSettings = {
  origin: settingsOrigin,
  fields: { "chat.defaultAgent": "aidlc", "chat.modelDefaults": { "claude-haiku-4.5": { [outputKey]: { effort: "low" } }, "claude-sonnet-4.6": { [outputKey]: { effort: "max", temperature: 0.2 }, custom: true } }, customSetting: ["keep"] },
  current: { "claude-haiku-4.5": "low", "claude-sonnet-4.6": "max" },
  models: {
    "claude-haiku-4.5": { fields: { [outputKey]: { effort: "low" } }, output: { effort: "low" } },
    "claude-sonnet-4.6": { fields: { [outputKey]: { effort: "max", temperature: 0.2 }, custom: true }, output: { effort: "max", temperature: 0.2 } },
  },
};
export const preservedSettingsText = '{"chat.defaultAgent":"aidlc","chat.modelDefaults":{"claude-haiku-4.5":{"output_config":{"effort":"low"}},"claude-sonnet-4.6":{"output_config":{"effort":"max","temperature":0.2},"custom":true}},"customSetting":["keep"]}';
export const nativeHighSettings = `{
  "chat.defaultAgent": "aidlc",
  "chat.modelDefaults": {
    "claude-sonnet-4.6": {
      "output_config": {
        "effort": "high"
      }
    }
  }
}
`;
export const nativePlainSettings = `{
  "chat.defaultAgent": "aidlc"
}
`;
export const invalidSettingsCases = ['[]', '{"chat.modelDefaults":[]}', '{"chat.modelDefaults":{"claude-sonnet-4.6":null}}', '{"chat.modelDefaults":{"claude-sonnet-4.6":{"output_config":false}}}', '{"chat.modelDefaults":{"claude-sonnet-4.6":{"output_config":{"effort":"turbo"}}}}'];
