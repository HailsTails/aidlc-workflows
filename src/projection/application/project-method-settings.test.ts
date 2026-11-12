import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { projectMethodSettings } from "./project-method-settings.ts";

const settings = { path: path(".native/settings.json"), mode: "regular",
  content: { kind: "text", text: "settings bytes" },
  origin: { kind: "rendered", concept: "settings", name: "settings.json" } } as const;
const hooks = { path: path(".native/hooks.json"), mode: "regular",
  content: { kind: "text", text: "hook bytes" },
  origin: { kind: "rendered", concept: "hook-registration", name: "hooks.json" } } as const;

test("settings and hook registrations consume the admitted Method exactly once in concept order", () => {
  const renderSettings = mock(() => accepted([settings]));
  const renderHookRegistrations = mock(() => accepted([hooks]));
  expect(projectMethodSettings({ method: methodSliceFixture,
    harness: { renderSettings, renderHookRegistrations } })).toEqual(accepted([settings, hooks]));
  expect(renderSettings).toHaveBeenCalledTimes(1);
  expect(renderSettings).toHaveBeenCalledWith({ method: methodSliceFixture });
  expect(renderHookRegistrations).toHaveBeenCalledTimes(1);
  expect(renderHookRegistrations).toHaveBeenCalledWith({ hooks: methodSliceFixture.hooks });
});

test("a shared settings and hook destination refuses through the existing collision owner", () => {
  expect(projectMethodSettings({ method: methodSliceFixture, harness: {
    renderSettings: () => accepted([settings]),
    renderHookRegistrations: () => accepted([{ ...hooks, path: settings.path }]),
  } })).toEqual(refused({ kind: "path-collision", path: path(".native/settings.json"),
    origins: [{ kind: "rendered", concept: "settings", name: "settings.json" },
      { kind: "rendered", concept: "hook-registration", name: "hooks.json" }],
  }));
});

test("renderer refusal keeps its real hook subject", () => {
  expect(projectMethodSettings({ method: methodSliceFixture, harness: {
    renderSettings: () => accepted([settings]), renderHookRegistrations: () => refused({
      kind: "render-failed", concept: "hook-registration", name: "stage-hooks", reason: "Unknown target",
    }),
  } })).toEqual(refused({ kind: "render-failed", concept: "hook-registration",
    name: "stage-hooks", reason: "Unknown target" }));
});
