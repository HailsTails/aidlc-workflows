import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../../../core/values/repo-path.ts";
import { check } from "./no-tmp-files.ts";

describe("probe PD-1 no-tmp-files path check", () => {
  it("is a path check", () => {
    expect(check.kind).toBe("path");
  });

  it("flags a file whose name ends .tmp.ts", () => {
    expect(check.inspect({ file: repoPathSchema.parse("src/scratch.tmp.ts") })).toBe("violates");
  });

  it("flags a nested file whose name ends .tmp.ts", () => {
    expect(check.inspect({ file: repoPathSchema.parse("src/deep/notes.tmp.ts") })).toBe("violates");
  });

  it("passes an ordinary TypeScript file", () => {
    expect(check.inspect({ file: repoPathSchema.parse("src/kept.ts") })).toBe("conforms");
  });

  it("passes a file with tmp elsewhere in its name", () => {
    expect(check.inspect({ file: repoPathSchema.parse("src/tmp.ts") })).toBe("conforms");
  });

  it("passes a file in a folder named like a temporary file", () => {
    expect(check.inspect({ file: repoPathSchema.parse("src/cache.tmp.ts/kept.ts") })).toBe("conforms");
  });
});
