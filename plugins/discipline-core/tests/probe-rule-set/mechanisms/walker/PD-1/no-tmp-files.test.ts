import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../../../core/values/repo-path.ts";
import { check } from "./no-tmp-files.ts";

describe("probe PD-1 no-tmp-files path check", () => {
  it("flags a file whose name ends .tmp.ts", () => {
    expect(check.inspect({ file: repoPathSchema.parse("src/scratch.tmp.ts") })).toBe("violates");
  });

  it("passes an ordinary TypeScript file", () => {
    expect(check.inspect({ file: repoPathSchema.parse("src/kept.ts") })).toBe("conforms");
  });
});
