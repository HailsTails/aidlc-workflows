import { expect, test } from "bun:test";
import { settingsOrigin, plainSettingsText, plainSettings, preservedSettingsText, preservedSettings, highPlan, emptyPlan, nativeHighSettings, nativePlainSettings, invalidSettingsCases } from "../../__tests__/kiro-settings-fixtures.ts";
import { parseKiroCliSettings, renderKiroCliSettings } from "./kiro-cli-settings.ts";

test("CLI settings parsing preserves native fields and extracts typed effort facts", () => {
  expect(parseKiroCliSettings({ text: preservedSettingsText, origin: settingsOrigin })).toEqual({ status: "ok", value: preservedSettings });
});
test("native settings without model defaults do not invent any", () => {
  expect(parseKiroCliSettings({ text: plainSettingsText, origin: settingsOrigin })).toEqual({ status: "ok", value: plainSettings });
});
test.each(invalidSettingsCases)("malformed known native settings fail at their boundary: %s", (text) => {
  expect(parseKiroCliSettings({ text, origin: settingsOrigin })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: settingsOrigin.path, detail: "expected Kiro CLI JSON settings with object model defaults, output configuration and recognized effort levels" }] });
});
test("JSON decoding failures become findings", () => {
  expect(parseKiroCliSettings({ text: "{", origin: settingsOrigin })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: settingsOrigin.path, detail: "expected Kiro CLI JSON settings" }] });
});
test("rendering places effort in the native shared settings field", () => {
  expect(renderKiroCliSettings({ settings: plainSettings, plan: highPlan })).toEqual({ status: "ok", value: { kind: "file", path: ".kiro/settings/cli.json", body: nativeHighSettings } });
});
test("an empty plan does not shadow personal model defaults with an empty map", () => {
  expect(renderKiroCliSettings({ settings: plainSettings, plan: emptyPlan })).toEqual({ status: "ok", value: { kind: "file", path: ".kiro/settings/cli.json", body: nativePlainSettings } });
});
test("a model plan cannot be applied to another source document", () => {
  expect(renderKiroCliSettings({ settings: plainSettings, plan: { ...highPlan, origin: { ...settingsOrigin, path: "another.json" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: settingsOrigin.path, detail: "Kiro model plan must belong to this CLI settings source" }] });
});
test("a stale model plan cannot lower newer stronger native defaults", () => {
  expect(renderKiroCliSettings({ settings: preservedSettings, plan: highPlan })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: settingsOrigin.path, detail: "Kiro model plan was prepared against different existing efforts; prepare again with this settings snapshot" }] });
});
