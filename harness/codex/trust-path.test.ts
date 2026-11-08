import { expect, test } from "bun:test";
import { codexTrustPath } from "./trust-path.ts";

test.each([
  ["/project with spaces", "/project with spaces/.codex/hooks.json"],
  ["/", "/.codex/hooks.json"],
  ["C:\\", "C:\\.codex\\hooks.json"],
  ["C:\\project", "C:\\project\\.codex\\hooks.json"],
  ["\\\\server\\share\\project", "\\\\server\\share\\project\\.codex\\hooks.json"],
  ["//server/share/project", "\\\\server\\share\\project\\.codex\\hooks.json"],
])("default path follows the project spelling: %s", (projectDir, expected) => {
  expect(codexTrustPath({ projectDir, harnessDir: ".codex" })).toBe(expected);
});

test("an explicit identity is never normalized", () => {
  expect(codexTrustPath({ projectDir: "/project", harnessDir: ".codex", hooksJsonPath: '//literal\\untouched/"hooks.json' })).toBe('//literal\\untouched/"hooks.json');
});
