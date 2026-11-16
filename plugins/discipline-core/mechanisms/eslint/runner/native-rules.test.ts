import { describe, expect, it } from "vitest";
import { defaultNativeRuleSources, eslintCoreRules, type NativeRuleSources, typescriptEslintRules } from "./native-rules.ts";

const MAX_PARAMS_RULE = { meta: { type: "suggestion" } };

const NO_EXPLICIT_ANY_RULE = { meta: { type: "problem" } };

const FAKE_SOURCES: NativeRuleSources = {
  eslintCore: new Map<string, object>([["max-params", MAX_PARAMS_RULE]]),
  typescriptEslint: { "no-explicit-any": NO_EXPLICIT_ANY_RULE },
};

describe("eslintCoreRules", () => {
  it("returns each named rule from the ESLint core rules it is handed, under its own name", () => {
    expect(eslintCoreRules({ names: ["max-params"], sources: FAKE_SOURCES })).toEqual({ "max-params": MAX_PARAMS_RULE });
  });

  it("leaves out a name the core rules hold no rule for, so the runner refuses the piece as naming a missing rule", () => {
    expect(eslintCoreRules({ names: ["not-a-core-rule"], sources: FAKE_SOURCES })).toEqual({});
  });

  it("reads the ESLint core rules of the copy core resolves through the default sources", () => {
    expect(eslintCoreRules({ names: ["max-params", "no-else-return"], sources: defaultNativeRuleSources })).toEqual({
      "max-params": expect.objectContaining({ create: expect.any(Function) }),
      "no-else-return": expect.objectContaining({ create: expect.any(Function) }),
    });
  });
});

describe("typescriptEslintRules", () => {
  it("returns each named typescript-eslint rule from the sources it is handed, under its own name", () => {
    expect(typescriptEslintRules({ names: ["no-explicit-any"], sources: FAKE_SOURCES })).toEqual({
      "no-explicit-any": NO_EXPLICIT_ANY_RULE,
    });
  });

  it("leaves out a name the sources hold no rule for, so the runner refuses the piece as naming a missing rule", () => {
    expect(typescriptEslintRules({ names: ["naming-convention"], sources: FAKE_SOURCES })).toEqual({});
  });

  it("reads the typescript-eslint rules of the copy core resolves through the default sources", () => {
    expect(typescriptEslintRules({ names: ["no-explicit-any"], sources: defaultNativeRuleSources })).toEqual({
      "no-explicit-any": expect.objectContaining({ create: expect.any(Function) }),
    });
  });
});
