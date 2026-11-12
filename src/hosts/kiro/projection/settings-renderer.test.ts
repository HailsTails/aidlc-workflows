import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { createKiroSettingsRenderer, KIRO_SETTINGS_INPUTS } from "./settings-renderer.ts";

const file = { source: source("settings/cli.json"), content: { kind: "text" as const, text: '{"model":"{{MODEL}}"}' } };
const prepared = { ...file, content: { kind: "text" as const, text: '{"model":"prepared"}' } };
const modeled = { ...file, content: { kind: "text" as const, text: '{"model":"captured-cap"}\n' } };
const inputs = settingsRenderingInputsFixture({ harnessDir: ".kiro", files: [file] });

test("settings capture CLI and exactly the two shipped hook registrations", () => {
  expect(KIRO_SETTINGS_INPUTS).toEqual([
    "settings/cli.json", "hooks/aidlc-record-human-turn.kiro.hook", "hooks/aidlc-plan-approval-guard.kiro.hook",
  ]);
});

test("CLI tokens are prepared once before the injected model policy", () => {
  const prepare = mock(() => accepted(prepared));
  const cliModels = mock(() => accepted(modeled));
  const render = createKiroSettingsRenderer({ ...inputs, prepare, cliModels });
  expect(render.renderSettings({ method: methodSliceFixture })).toEqual(accepted([{
    path: path(".kiro/settings/cli.json"), content: modeled.content, mode: "regular",
    origin: { kind: "harness-authored", source: file.source },
  }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith(file);
  expect(cliModels).toHaveBeenCalledTimes(1);
  expect(cliModels).toHaveBeenCalledWith(prepared);
});

test("missing CLI input is a typed refusal", () => {
  expect(createKiroSettingsRenderer({ ...inputs, files: [] }).renderSettings({ method: methodSliceFixture })).toEqual(refused({
    kind: "render-failed", concept: "settings", name: "settings/cli.json",
    reason: "The authored Kiro CLI settings were not captured.",
  }));
});

test("preparation failure is preserved and does not invoke model policy", () => {
  const failure = refused({ kind: "render-failed" as const, concept: "settings" as const,
    name: "settings/cli.json", reason: "Token preparation refused." });
  const cliModels = mock(() => accepted(modeled));
  expect(createKiroSettingsRenderer({ ...inputs, prepare: () => failure, cliModels }).renderSettings({ method: methodSliceFixture }))
    .toEqual(failure);
  expect(cliModels).not.toHaveBeenCalled();
});

test("model-policy refusal is preserved", () => {
  const failure = refused({ kind: "render-failed" as const, concept: "settings" as const,
    name: "settings/cli.json", reason: "The authored CLI JSON is malformed." });
  expect(createKiroSettingsRenderer({ ...inputs, cliModels: () => failure }).renderSettings({ method: methodSliceFixture })).toEqual(failure);
});
