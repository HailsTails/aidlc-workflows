import { z } from "zod";
import type { AgentOrigin } from "../domain/agent-definition.ts";
import type { KiroEffort, KiroModelPlan } from "../domain/kiro-model-defaults.ts";
import type { NativeResource } from "../domain/native-rendering.ts";
import { finding, sourceKey, type Outcome } from "../domain/model.ts";

const defaultsKey = "chat.modelDefaults";
const outputKey = "output_config";
const outputSchema = z.object({ effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional() }).catchall(z.json());
const modelSchema = z.object({ [outputKey]: outputSchema.optional() }).catchall(z.json());
const settingsSchema = z.record(z.string(), z.json()).and(z.object({ [defaultsKey]: z.record(z.string(), modelSchema).optional() }).passthrough());
type NativeSettingValue = string | number | boolean | null | readonly NativeSettingValue[] | { readonly [key: string]: NativeSettingValue };
type SettingsFields = Readonly<Record<string, NativeSettingValue>>;
type ModelSettings = { readonly fields: SettingsFields; readonly output: SettingsFields };
export type KiroCliSettings = {
  readonly origin: AgentOrigin;
  readonly fields: SettingsFields;
  readonly models: Readonly<Record<string, ModelSettings>>;
  readonly current: Readonly<Record<string, KiroEffort | null>>;
};
export const parseKiroCliSettings = ({ text, origin }: { readonly text: string; readonly origin: AgentOrigin }): Outcome<KiroCliSettings> => {
  try {
    const decoded: unknown = JSON.parse(text);
    const parsed = settingsSchema.safeParse(decoded);
    if (!parsed.success)
      return { status: "invalid", findings: [finding({ code: "invalid-input", subject: origin.path, detail: "expected Kiro CLI JSON settings with object model defaults, output configuration and recognized effort levels" })] };
    const current = Object.fromEntries(Object.entries(parsed.data[defaultsKey] ?? {}).map(([model, entry]) => [model, entry[outputKey]?.effort ?? null]));
    const models = Object.fromEntries<ModelSettings>(Object.entries(parsed.data[defaultsKey] ?? {}).map(([model, entry]) => [model, { fields: entry, output: entry[outputKey] ?? {} }]));
    return { status: "ok", value: { origin, fields: parsed.data, current, models } };
  } catch {
    return { status: "invalid", findings: [finding({ code: "invalid-json", subject: origin.path, detail: "expected Kiro CLI JSON settings" })] };
  }
};
export const renderKiroCliSettings = ({ settings, plan }: { readonly settings: KiroCliSettings; readonly plan: KiroModelPlan }): Outcome<NativeResource> => {
  if (settings.origin.pin !== plan.origin.pin || settings.origin.path !== plan.origin.path || sourceKey(settings.origin.source) !== sourceKey(plan.origin.source))
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: settings.origin.path, detail: "Kiro model plan must belong to this CLI settings source" })] };
  const current = JSON.stringify(Object.entries(settings.current).sort(([left], [right]) => left.localeCompare(right)));
  const baseline = JSON.stringify(Object.entries(plan.baseline).sort(([left], [right]) => left.localeCompare(right)));
  if (current !== baseline)
    return { status: "invalid", findings: [finding({ code: "invalid-input", subject: settings.origin.path, detail: "Kiro model plan was prepared against different existing efforts; prepare again with this settings snapshot" })] };
  const existing = Object.fromEntries<NativeSettingValue>(Object.entries(settings.models).map(([model, entry]) => [model, entry.fields]));
  const defaults = Object.entries(plan.updates).reduce<Readonly<Record<string, NativeSettingValue>>>((merged, [model, effort]) => {
    const entry = settings.models[model];
    return { ...merged, [model]: { ...entry?.fields, [outputKey]: { ...entry?.output, effort } } };
  }, existing);
  const fields = Object.keys(defaults).length > 0 || defaultsKey in settings.fields ? { ...settings.fields, [defaultsKey]: defaults } : settings.fields;
  return { status: "ok", value: { kind: "file", path: ".kiro/settings/cli.json", body: `${JSON.stringify(fields, null, 2)}\n` } };
};
