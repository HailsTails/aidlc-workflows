import { expect, test } from "vitest";
import { entriesAfterDirectoryFailure } from "./rin-harness-sidecar-file-reader.ts";

test("an absent optional directory is an empty population", () => {
  expect(entriesAfterDirectoryFailure({
    error: Object.assign(new Error("fixture directory absent"), { code: "ENOENT" }),
  })).toEqual([]);
});

test.each(["EACCES", "EPERM", "ENOTDIR", "EIO"])("%s cannot be treated as an empty directory", (code) => {
  expect(entriesAfterDirectoryFailure({
    error: Object.assign(new Error("fixture directory unreadable"), { code }),
  })).toBeUndefined();
});

test("an unclassified failure cannot establish an empty directory", () => {
  expect(entriesAfterDirectoryFailure({ error: new Error("fixture failure") })).toBeUndefined();
});

test("an unknown thrown value cannot establish an empty directory", () => {
  expect(entriesAfterDirectoryFailure({ error: "fixture failure" })).toBeUndefined();
});
