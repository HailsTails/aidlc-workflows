import { describe, expect, it } from "vitest";
import { eslintPluginModuleSchema, inlineConfigNodesSchema } from "./eslint-plugin-schema.ts";

const createsNoVisitor = () => ({});

const noClassRule = {
  meta: {
    type: "problem",
    messages: { found: "class authored" },
    schema: [],
    docs: { description: "no class authoring" },
    fixable: "code",
  },
  create: createsNoVisitor,
};

describe("eslintPluginModuleSchema", () => {
  it("accepts a module default-exporting a plugin whose rules each carry a meta type and a create function", () => {
    expect(
      eslintPluginModuleSchema.safeParse({ default: { rules: { "no-class": noClassRule } } })
        .success,
    ).toBe(true);
  });

  it("accepts a rule whose meta has no messages", () => {
    expect(
      eslintPluginModuleSchema.safeParse({
        default: { rules: { "no-class": { meta: { type: "suggestion" }, create: createsNoVisitor } } },
      }).success,
    ).toBe(true);
  });

  it("keeps the rule meta fields the schema does not name", () => {
    expect(
      eslintPluginModuleSchema.safeParse({ default: { rules: { "no-class": noClassRule } } }),
    ).toMatchObject({
      success: true,
      data: {
        default: {
          rules: {
            "no-class": {
              meta: {
                schema: [],
                docs: { description: "no class authoring" },
                fixable: "code",
              },
            },
          },
        },
      },
    });
  });

  it("keeps the plugin fields beside its rules", () => {
    expect(
      eslintPluginModuleSchema.safeParse({
        default: { meta: { name: "cd14" }, rules: { "no-class": noClassRule } },
      }),
    ).toMatchObject({ success: true, data: { default: { meta: { name: "cd14" } } } });
  });

  it("refuses a rule whose create is not a function, at its create key", () => {
    expect(
      eslintPluginModuleSchema.safeParse({
        default: { rules: { "no-class": { meta: { type: "problem" }, create: 3 } } },
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: ["default", "rules", "no-class", "create"] }] },
    });
  });

  it("refuses a rule meta type outside problem, suggestion and layout, at its type key", () => {
    expect(
      eslintPluginModuleSchema.safeParse({
        default: { rules: { "no-class": { meta: { type: "style" }, create: createsNoVisitor } } },
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: ["default", "rules", "no-class", "meta", "type"] }] },
    });
  });

  it("refuses a rule with no meta, at its meta key", () => {
    expect(
      eslintPluginModuleSchema.safeParse({
        default: { rules: { "no-class": { create: createsNoVisitor } } },
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: ["default", "rules", "no-class", "meta"] }] },
    });
  });

  it("refuses a rule message that is not a string, at that message's key", () => {
    expect(
      eslintPluginModuleSchema.safeParse({
        default: {
          rules: {
            "no-class": {
              meta: { type: "problem", messages: { found: 1 } },
              create: createsNoVisitor,
            },
          },
        },
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: ["default", "rules", "no-class", "meta", "messages", "found"] }] },
    });
  });

  it("refuses a module whose plugin has no rules, at the rules key", () => {
    expect(eslintPluginModuleSchema.safeParse({ default: { meta: { name: "cd14" } } })).toMatchObject(
      { success: false, error: { issues: [{ path: ["default", "rules"] }] } },
    );
  });

  it("refuses a module with no default export, at the default key", () => {
    expect(
      eslintPluginModuleSchema.safeParse({ classAuthoringPlugin: { rules: {} } }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["default"] }] } });
  });

  it("refuses a module that is not an object", () => {
    expect(eslintPluginModuleSchema.safeParse(undefined).success).toBe(false);
  });

  it("makes a parsed rule's create throw when it returns a visitor that is not a function", () => {
    const parsedModule = eslintPluginModuleSchema.parse({
      default: {
        rules: { "no-class": { meta: { type: "problem" }, create: () => ({ Program: 3 }) } },
      },
    });

    expect(() => parsedModule.default.rules["no-class"].create({})).toThrow();
  });
});

const blockDisableNode = {
  type: "Block",
  value: " eslint-disable cd/no-class ",
  range: [13, 45],
  loc: { start: { line: 2, column: 0 }, end: { line: 2, column: 32 } },
};

describe("inlineConfigNodesSchema", () => {
  it("accepts the comment nodes ESLint returns, keeping their location", () => {
    expect(
      inlineConfigNodesSchema.safeParse([
        blockDisableNode,
        {
          type: "Line",
          value: " eslint-disable-line cd/no-class",
          range: [13, 46],
          loc: { start: { line: 1, column: 13 }, end: { line: 1, column: 46 } },
        },
      ]),
    ).toEqual({
      success: true,
      data: [
        blockDisableNode,
        {
          type: "Line",
          value: " eslint-disable-line cd/no-class",
          range: [13, 46],
          loc: { start: { line: 1, column: 13 }, end: { line: 1, column: 46 } },
        },
      ],
    });
  });

  it("refuses a node list that is not an array", () => {
    expect(inlineConfigNodesSchema.safeParse(undefined).success).toBe(false);
  });

  it("refuses a node with no value, at its value key", () => {
    expect(
      inlineConfigNodesSchema.safeParse([
        { type: "Block", loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 4 } } },
      ]),
    ).toMatchObject({ success: false, error: { issues: [{ path: [0, "value"] }] } });
  });
});
