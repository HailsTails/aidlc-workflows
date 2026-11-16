import { describe, expect, it } from "vitest";
import { eslintPieceSettingsSchema } from "./eslint-piece-settings-schema.ts";

const settings = {
  pluginNamespace: "discipline",
  pluginModule: "cd14/cd14.eslint-plugin.ts",
  rule: "no-class-authoring",
};

describe("eslintPieceSettingsSchema", () => {
  it("accepts a namespace, a plugin module inside the piece folder ending in .ts, and a rule", () => {
    expect(eslintPieceSettingsSchema.safeParse(settings)).toEqual({ success: true, data: settings });
  });

  it("accepts a plugin module at the piece folder's root", () => {
    expect(
      eslintPieceSettingsSchema.safeParse({ ...settings, pluginModule: "plugin.ts" }),
    ).toEqual({ success: true, data: { ...settings, pluginModule: "plugin.ts" } });
  });

  it.each([
    "../x.ts",
    "../x.js",
    "cd14/../../x.ts",
    "./x.ts",
    "cd14//x.ts",
    "/install/x.ts",
    "C:/install/x.ts",
    "cd14\\x.ts",
  ])("refuses the plugin module %s at the pluginModule key", (pluginModule) => {
    expect(eslintPieceSettingsSchema.safeParse({ ...settings, pluginModule })).toMatchObject({
      success: false,
      error: { issues: [{ path: ["pluginModule"] }] },
    });
  });

  it("accepts a plugin module ending in .js, as a built install ships it", () => {
    expect(
      eslintPieceSettingsSchema.safeParse({ ...settings, pluginModule: "cd14/cd14.eslint-plugin.js" }),
    ).toEqual({ success: true, data: { ...settings, pluginModule: "cd14/cd14.eslint-plugin.js" } });
  });

  it.each(["cd14/cd14.eslint-plugin.mjs", "cd14/cd14.eslint-plugin.cjs", "cd14/plugin"])(
    "refuses the plugin module %s, which ends in neither .ts nor .js, at the pluginModule key",
    (pluginModule) => {
      expect(eslintPieceSettingsSchema.safeParse({ ...settings, pluginModule })).toMatchObject({
        success: false,
        error: { issues: [{ path: ["pluginModule"] }] },
      });
    },
  );

  it("refuses a audit piece's module key as an unknown key", () => {
    expect(
      eslintPieceSettingsSchema.safeParse({ ...settings, module: "class-syntax.ts" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["module"] }] },
    });
  });

  it("refuses settings with no rule, at the rule key", () => {
    expect(
      eslintPieceSettingsSchema.safeParse({
        pluginNamespace: "discipline",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["rule"] }] } });
  });

  it("refuses a plugin namespace that is not a string, at the pluginNamespace key", () => {
    expect(
      eslintPieceSettingsSchema.safeParse({ ...settings, pluginNamespace: 14 }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["pluginNamespace"] }] } });
  });
});
