import { expect, test } from "bun:test";
import { claudeSettingsPaths } from "./harness-settings.ts";
test("authored settings delivery includes an example rather than a personal override", () => {
  expect(claudeSettingsPaths()).toEqual([".claude/settings.json", ".claude/settings.local.json.example"]);
});
