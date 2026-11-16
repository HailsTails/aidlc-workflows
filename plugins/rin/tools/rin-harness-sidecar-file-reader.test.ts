import { expect, test } from "vitest";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileTextPort, entriesAfterDirectoryFailure } from "./rin-harness-sidecar-file-reader.ts";

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

test("a linked directory reads the files of its target", () => {
  const files = defaultFileTextPort();
  const paths = defaultPathOperations();
  const root = files.makeTemporaryDirectory(paths.join({ segments: [files.temporaryRoot(), "rin-linked-directory-"] }));
  const target = paths.join({ segments: [root, "target"] });
  files.mkdir(target);
  files.write(paths.join({ segments: [target, "kept.txt"] }), "kept\n");
  files.linkDirectory(target, paths.join({ segments: [root, "link"] }));
  const linked = files.read(paths.join({ segments: [root, "link", "kept.txt"] }));
  files.remove(root, { recursive: true, force: true });
  expect(linked).toBe("kept\n");
});