// covers: function:discoverCoLocatedTests, function:discoverUnitTests, function:coLocatedTestKey, function:unitTestKey

import { expect, mock, test } from "bun:test";
import { coLocatedTestKey, discoverCoLocatedTests, discoverUnitTests, type TestDirectoryReader, unitTestKey } from "./test-discovery.ts";

test("missing authored roots contain no co-located tests", () => {
  const readDirectory = mock<TestDirectoryReader>().mockReturnValue(null);
  expect(discoverCoLocatedTests({ repositoryRoot: "/repo", readDirectory })).toEqual([]);
  expect(readDirectory).toHaveBeenCalledWith({ directory: "/repo/core" });
  expect(readDirectory).toHaveBeenCalledWith({ directory: "/repo/harness" });
  expect(readDirectory).toHaveBeenCalledWith({ directory: "/repo/scripts" });
});

test("nested authored tests are sorted and generated, fixture and linked directories are not traversed", () => {
  const readDirectory = mock<TestDirectoryReader>()
    .mockReturnValueOnce([
      { name: "tools", kind: "directory" }, { name: "dist", kind: "directory" },
      { name: "fixtures", kind: "directory" }, { name: "linked", kind: "other" },
    ])
    .mockReturnValueOnce([
      { name: "z.test.ts", kind: "file" }, { name: "a.test.ts", kind: "file" },
      { name: "helper.ts", kind: "file" }, { name: "fake.test.ts", kind: "directory" },
    ])
    .mockReturnValueOnce(null)
    .mockReturnValueOnce(null)
    .mockReturnValueOnce([{ name: "compile.test.ts", kind: "file" }]);
  expect(discoverCoLocatedTests({ repositoryRoot: "/repo", readDirectory })).toEqual([
    "/repo/core/tools/a.test.ts", "/repo/core/tools/z.test.ts", "/repo/scripts/compile.test.ts",
  ]);
  expect(readDirectory).not.toHaveBeenCalledWith({ directory: "/repo/core/dist" });
  expect(readDirectory).not.toHaveBeenCalledWith({ directory: "/repo/core/fixtures" });
  expect(readDirectory).not.toHaveBeenCalledWith({ directory: "/repo/core/linked" });
});

test("source identities distinguish equal basenames and path punctuation", () => {
  expect(coLocatedTestKey({ repositoryRoot: "/repo", file: "/repo/core/tools/read.test.ts" })).toBe("source-core%2Ftools%2Fread.test.ts");
  expect(coLocatedTestKey({ repositoryRoot: "/repo", file: "/repo/scripts/read.test.ts" })).toBe("source-scripts%2Fread.test.ts");
  expect(coLocatedTestKey({ repositoryRoot: "/repo", file: "/repo/core/a-b/read.test.ts" })).toBe("source-core%2Fa-b%2Fread.test.ts");
  expect(coLocatedTestKey({ repositoryRoot: "/repo", file: "/repo/core/a/b-read.test.ts" })).toBe("source-core%2Fa%2Fb-read.test.ts");
});

test("Windows paths and trailing root separators share the same identity", () => {
  expect(coLocatedTestKey({ repositoryRoot: "H:\\repo\\", file: "H:\\repo\\core\\tools\\read.test.ts" })).toBe("source-core%2Ftools%2Fread.test.ts");
});

test("ordinary tier tests preserve their historical shard key", () => {
  expect(unitTestKey({ repositoryRoot: "/repo", file: "/repo/tests/unit/t-reader.test.ts" })).toBe("t-reader.test.ts");
  expect(coLocatedTestKey({ repositoryRoot: "/repo", file: "/repo/tests/unit/t-reader.test.ts" })).toBeNull();
  expect(coLocatedTestKey({ repositoryRoot: "/repo", file: "/repo-other/core/read.test.ts" })).toBeNull();
});

test("the unit inventory retains ordinary tests and appends each authored source test once", () => {
  const readDirectory = mock<TestDirectoryReader>()
    .mockReturnValueOnce([{ name: "t-unit.test.ts", kind: "file" }, { name: "helper.ts", kind: "file" }])
    .mockReturnValueOnce([{ name: "unit.test.ts", kind: "file" }])
    .mockReturnValueOnce(null)
    .mockReturnValueOnce([{ name: "unit.test.ts", kind: "file" }]);
  expect(discoverUnitTests({ repositoryRoot: "/repo", readDirectory })).toEqual([
    "/repo/tests/unit/t-unit.test.ts", "/repo/core/unit.test.ts", "/repo/scripts/unit.test.ts",
  ]);
});
