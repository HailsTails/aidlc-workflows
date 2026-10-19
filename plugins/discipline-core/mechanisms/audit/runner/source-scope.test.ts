import { describe, expect, it } from "vitest";
import { folderScope } from "./source-scope.ts";

describe("folderScope", () => {
  it.each([
    { name: "node_modules at root", file: "node_modules/a.ts", expected: "generated" },
    { name: "node_modules nested", file: "src/a/node_modules/b.ts", expected: "generated" },
    { name: "dist at root", file: "dist/a.ts", expected: "generated" },
    { name: "dist nested", file: "src/a/dist/b.ts", expected: "generated" },
    { name: "build at root", file: "build/a.ts", expected: "generated" },
    { name: "build nested", file: "src/a/build/b.ts", expected: "generated" },
    { name: "coverage at root", file: "coverage/a.ts", expected: "generated" },
    { name: "coverage nested", file: "src/a/coverage/b.ts", expected: "generated" },
    { name: ".git at root", file: ".git/a.ts", expected: "generated" },
    { name: ".git nested", file: "src/a/.git/b.ts", expected: "generated" },
    { name: "vendor at root", file: "vendor/a.ts", expected: "generated" },
    { name: "vendor at root with depth", file: "vendor/a/b.ts", expected: "generated" },
    { name: "vendor nested", file: "src/vendor/a.ts", expected: "authored" },
    { name: "plain file", file: "src/a/b.ts", expected: "authored" },
    { name: "root file", file: "a.ts", expected: "authored" },
    { name: "file named like a generated folder", file: "src/dist.ts", expected: "authored" },
  ])("scopes $name as $expected", ({ file, expected }) => {
    expect(folderScope({ file })).toBe(expected);
  });
});
