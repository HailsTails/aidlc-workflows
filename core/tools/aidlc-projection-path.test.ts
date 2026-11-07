// covers: function:checkProjectionPath

import { expect, test } from "bun:test";
import { checkProjectionPath } from "./aidlc-projection-path.ts";

test.each([".claude", "tools/aidlc.ts", "aidlc/spaces/default", "folder/a..b", "file:stream", "1:odd", " name with spaces ", "中文/条目", "CON"])("relative metadata retains its declared spelling: %s", (path) => {
  expect(checkProjectionPath({ path })).toEqual({ kind: "accepted", path });
});

test.each(["", "a\0b", "\\absolute", "folder\\file", "/absolute", "//server/share", "C:relative", "C:/absolute", "z:", "a//b", "./a", "a/./b", "a/../b", "a/", "../a", ".", ".."])("unsafe relative metadata is refused: %s", (path) => {
  expect(checkProjectionPath({ path })).toEqual({ kind: "refused" });
});

test.each([{ path: null }, { path: undefined }, { path: 0 }, { path: 1 }, { path: true }, { path: false }, { path: {} }, { path: [] }])("non-string metadata is refused without conversion: %s", ({ path }) => {
  expect(checkProjectionPath({ path })).toEqual({ kind: "refused" });
});

test.each([".claude", "name with spaces", "中文", "file:stream", "a..b"])("top-level names retain their declared spelling: %s", (path) => {
  expect(checkProjectionPath({ path, scope: "top-level-name" })).toEqual({ kind: "accepted", path });
});

test.each(["folder/file", ".claude/rules/x.md", "a/b/c"])("nested paths cannot be top-level names: %s", (path) => {
  expect(checkProjectionPath({ path, scope: "top-level-name" })).toEqual({ kind: "refused" });
});

test("an explicit relative-path scope keeps nested metadata accepted", () => {
  expect(checkProjectionPath({ path: "folder/file", scope: "relative-path" })).toEqual({ kind: "accepted", path: "folder/file" });
});
