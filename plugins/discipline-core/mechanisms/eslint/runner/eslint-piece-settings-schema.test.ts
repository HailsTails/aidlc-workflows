import { describe, expect, it } from "vitest";
import { eslintPieceSettingsSchema } from "./eslint-piece-settings-schema.ts";

const settings = {
  pluginNamespace: "rin-discipline",
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

  it.each(["cd14/cd14.eslint-plugin.js", "cd14/cd14.eslint-plugin.mjs", "cd14/plugin"])(
    "refuses the plugin module %s, which does not end in .ts, at the pluginModule key",
    (pluginModule) => {
      expect(eslintPieceSettingsSchema.safeParse({ ...settings, pluginModule })).toMatchObject({
        success: false,
        error: { issues: [{ path: ["pluginModule"] }] },
      });
    },
  );

  it("refuses a walker piece's module key as an unknown key", () => {
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
        pluginNamespace: "rin-discipline",
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
