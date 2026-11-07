import { describe, expect, it } from "vitest";
import { defaultEslintBuiltinRules, eslintCoreRules, typescriptEslintRules } from "./native-rules.ts";

const MAX_PARAMS_RULE = { meta: { type: "suggestion" } };

const FAKE_BUILTIN_RULES = new Map<string, object>([["max-params", MAX_PARAMS_RULE]]);

describe("eslintCoreRules", () => {
  it("returns each named rule from the builtin rules it is handed, under its own name", () => {
    expect(eslintCoreRules({ names: ["max-params"], builtinRules: FAKE_BUILTIN_RULES })).toEqual({
      "max-params": MAX_PARAMS_RULE,
    });
  });

  it("leaves out a name the builtin rules hold no rule for, so the runner refuses the piece as naming a missing rule", () => {
    expect(eslintCoreRules({ names: ["not-a-core-rule"], builtinRules: FAKE_BUILTIN_RULES })).toEqual({});
  });

  it("reads ESLint's own core rules through the default builtin rules", () => {
    expect(eslintCoreRules({ names: ["max-params", "no-else-return"], builtinRules: defaultEslintBuiltinRules })).toEqual({
      "max-params": expect.objectContaining({ create: expect.any(Function) }),
      "no-else-return": expect.objectContaining({ create: expect.any(Function) }),
    });
  });
});

describe("typescriptEslintRules", () => {
  it("returns each named typescript-eslint rule under its own name", () => {
    expect(typescriptEslintRules({ names: ["no-explicit-any"] })).toEqual({
      "no-explicit-any": expect.objectContaining({ create: expect.any(Function) }),
    });
  });
});
