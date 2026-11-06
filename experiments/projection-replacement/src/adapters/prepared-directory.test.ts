import { expect, mock, test } from "bun:test";
import { createPreparedDirectoryReader } from "./prepared-directory.ts";
import { missingDirectoryError } from "../../__tests__/prepared-directory-fixtures.ts";
test.each([
  ["directory", { status: "ok", value: [{ path: ".claude/skills" }] }],
  ["other", { status: "invalid", findings: [{ code: "invalid-input", subject: ".claude/skills", detail: "prepared runner directory path is occupied by a non-directory" }] }],
] as const)("directory observation cannot be inferred from its filename: %s", async (kind, expected) => {
  expect(await createPreparedDirectoryReader({ operations: { kind: mock().mockResolvedValue(kind) } }).read({ root: "private", path: ".claude/skills" })).toEqual(expected);
});
test("an absent optional directory remains absent rather than a failure", async () => {
  expect(await createPreparedDirectoryReader({ operations: { kind: mock().mockRejectedValue(missingDirectoryError()) } }).read({ root: "private", path: ".claude/skills" })).toEqual({ status: "ok", value: [] });
});
test.each([
  [new Error("ENOENT")],
  [new Error("private denied-path information")],
  [{ code: "ENOENT" }],
])("unclassified failures cannot impersonate an admitted missing directory", async (error) => {
  expect(await createPreparedDirectoryReader({ operations: { kind: mock().mockRejectedValue(error) } }).read({ root: "private", path: ".claude/skills" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/skills", detail: "prepared runner directory observation unavailable" }] });
});
