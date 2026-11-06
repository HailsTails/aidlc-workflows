import { expect, test } from "vitest";
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

import { defaultPathOperations } from "./rin-harness-path-operations.ts";

test("the file boundary copies an owned fixture tree without changing its source", () => {
  const files = defaultFileTextPort();
  const paths = defaultPathOperations();
  const root = files.makeTemporaryDirectory(paths.join({ segments: [files.temporaryRoot(), "rin-copy-boundary-"] }));
  const source = paths.join({ segments: [root, "source"] });
  const destination = paths.join({ segments: [root, "destination"] });
  const nested = paths.join({ segments: [source, "nested"] });
  try {
    files.mkdir(nested, { recursive: true });
    files.write(paths.join({ segments: [nested, "evidence.txt"] }), "Original bytes.\r\n");
    files.copyTree({ source, destination });
    expect(files.read(paths.join({ segments: [destination, "nested/evidence.txt"] }))).toBe("Original bytes.\r\n");
    expect(files.read(paths.join({ segments: [nested, "evidence.txt"] }))).toBe("Original bytes.\r\n");
  } finally {
    files.remove(root, { recursive: true, force: true });
  }
});
