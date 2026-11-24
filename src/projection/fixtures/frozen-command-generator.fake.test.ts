import { expect, test } from "bun:test";
import { createRecordingFrozenCommandGenerator, frozenGeneratorFailure } from "./frozen-command-generator.fake.ts";

test("the fake failure seam preserves the exact unexpected exception", () => {
  const failure = new Error("exact frozen capability failure");
  expect(() => frozenGeneratorFailure(failure)).toThrow(failure);
});

test("the fake preserves discovery identity and records calls with literal rendered text", () => {
  const discovery = { stages: [], scopes: { feature: { description: "Feature" } }, selected: ["feature"] };
  const generator = createRecordingFrozenCommandGenerator(discovery);
  expect(generator.discover()).toBe(discovery);
  expect(generator.renderScope("feature", "Feature")).toBe("---\nname: feature\n---\nFeature\n");
  expect(generator.renderInit()).toBe("---\nname: aidlc-init\n---\nInit\n");
  expect(generator.renderCompose()).toBe("---\nname: aidlc-compose\n---\nCompose\n");
  generator.regenerate();
  expect(generator.calls()).toEqual(["discover", "scope:feature", "init", "compose", "regenerate"]);
});
