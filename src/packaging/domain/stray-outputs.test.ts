import { expect, test } from "bun:test";
import { strayOutputs } from "./stray-outputs.ts";

test("the full copy root retains hosts and plugins but removes unexpected files and folders", () => {
  expect(strayOutputs({ present: ["claude", "old-host", "README.tmp", "plugins", "codex"],
    expected: ["claude", "codex", "plugins"] })).toEqual(["old-host", "README.tmp"]);
});

test("the native root removes plugins unless the caller expects that entry", () => {
  expect(strayOutputs({ present: ["plugins", "claude"], expected: ["claude"] })).toEqual(["plugins"]);
});

test("membership is exact, case-sensitive, and independent of name prefixes", () => {
  expect(strayOutputs({ present: ["codex-old", "CODEX", "codex", "plugin", "plugins"],
    expected: ["codex", "plugins"] })).toEqual(["codex-old", "CODEX", "plugin"]);
});

test("missing expected entries are not removals and duplicate expectations do not change selection", () => {
  expect(strayOutputs({ present: ["codex", "old"], expected: ["codex", "claude", "codex"] })).toEqual(["old"]);
});

test("an absent inventory needs no cleanup and empty expectations select all entries", () => {
  expect(strayOutputs({ present: [], expected: ["claude"] })).toEqual([]);
  expect(strayOutputs({ present: ["z-old", "a-old"], expected: [] })).toEqual(["z-old", "a-old"]);
});

test("selection preserves the present inventory order without mutating frozen inputs", () => {
  const present = Object.freeze(["z-old", "claude", "a-old"]);
  const expected = Object.freeze(["claude"]);
  expect(strayOutputs({ present, expected })).toEqual(["z-old", "a-old"]);
  expect(present).toEqual(["z-old", "claude", "a-old"]);
  expect(expected).toEqual(["claude"]);
});
