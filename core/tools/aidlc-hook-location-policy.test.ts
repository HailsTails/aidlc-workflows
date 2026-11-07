// covers: function:planHookLocation

import { expect, test } from "bun:test";
import { planHookLocation } from "./aidlc-hook-location-policy.ts";

test.each(["aidlc-human-turn.ts", "aidlc-codex-adapter.ts", "custom-hook.ts", "AIDLC-STATUSLINE.ts", "nested/aidlc-statusline.ts"])("native %s has no project or source fallback", (hookFile) => {
  expect(planHookLocation({ execution: "native", hookFile, moduleHookPath: "source/hook.ts", projectHookPaths: ["project/hook.ts"], packagedHookPath: "runtime/hook.ts" })).toEqual({ kind: "fixed", path: "runtime/hook.ts" });
});

test("a damaged native runtime does not switch to project authority", () => {
  expect(planHookLocation({ execution: "native", hookFile: "aidlc-human-turn.ts", moduleHookPath: "source/hook.ts", projectHookPaths: ["project/hook.ts"], packagedHookPath: "" })).toEqual({ kind: "fixed", path: "" });
});

test("native statusline customization searches project paths in discovery order", () => {
  expect(planHookLocation({ execution: "native", hookFile: "aidlc-statusline.ts", moduleHookPath: "source/statusline.ts", projectHookPaths: ["second/statusline.ts", "first/statusline.ts"], packagedHookPath: "runtime/statusline.ts" })).toEqual({ kind: "search", candidates: ["second/statusline.ts", "first/statusline.ts", "runtime/statusline.ts"], fallback: "runtime/statusline.ts" });
});

test("native statusline with no project candidates retains its runtime fallback", () => {
  expect(planHookLocation({ execution: "native", hookFile: "aidlc-statusline.ts", moduleHookPath: "source/statusline.ts", projectHookPaths: [], packagedHookPath: "" })).toEqual({ kind: "search", candidates: [""], fallback: "" });
});

test.each(["aidlc-human-turn.ts", "aidlc-statusline.ts"])("copy %s searches source, project, then packaged paths", (hookFile) => {
  expect(planHookLocation({ execution: "copy", hookFile, moduleHookPath: "source/hook.ts", projectHookPaths: ["project/hook.ts", "other/hook.ts"], packagedHookPath: "runtime/hook.ts" })).toEqual({ kind: "search", candidates: ["source/hook.ts", "project/hook.ts", "other/hook.ts", "runtime/hook.ts"], fallback: "source/hook.ts" });
});

test("lookup planning preserves duplicates and empty candidate spellings", () => {
  expect(planHookLocation({ execution: "copy", hookFile: "hook.ts", moduleHookPath: "same.ts", projectHookPaths: ["same.ts", "", "same.ts"], packagedHookPath: "" })).toEqual({ kind: "search", candidates: ["same.ts", "same.ts", "", "same.ts", ""], fallback: "same.ts" });
});

test("lookup planning leaves frozen discovery facts unchanged", () => {
  const projectHookPaths = Object.freeze(["project/hook.ts"]);
  expect(planHookLocation({ execution: "copy", hookFile: "hook.ts", moduleHookPath: "source/hook.ts", projectHookPaths, packagedHookPath: "runtime/hook.ts" })).toEqual({ kind: "search", candidates: ["source/hook.ts", "project/hook.ts", "runtime/hook.ts"], fallback: "source/hook.ts" });
  expect(projectHookPaths).toEqual(["project/hook.ts"]);
});
