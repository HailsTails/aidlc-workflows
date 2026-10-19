import { describe, expect, it } from "vitest";
import { eslintCoreRules, typescriptEslintRules } from "./native-rules.ts";

describe("eslintCoreRules", () => {
  it("returns each named ESLint core rule under its own name", () => {
    expect(eslintCoreRules({ names: ["max-params", "no-else-return"] })).toEqual({
      "max-params": expect.objectContaining({ create: expect.any(Function) }),
      "no-else-return": expect.objectContaining({ create: expect.any(Function) }),
    });
  });

  it("leaves out a name ESLint has no core rule for, so the runner refuses the piece as naming a missing rule", () => {
    expect(eslintCoreRules({ names: ["not-a-core-rule"] })).toEqual({});
  });
});

describe("typescriptEslintRules", () => {
  it("returns each named typescript-eslint rule under its own name", () => {
    expect(typescriptEslintRules({ names: ["no-explicit-any"] })).toEqual({
      "no-explicit-any": expect.objectContaining({ create: expect.any(Function) }),
    });
  });
});
