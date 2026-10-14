import { describe, expect, it } from "vitest";
import { isRepoPathText, repoPathSchema } from "./repo-path.ts";

const ACCEPTED = [
  "a.ts",
  "src/a.ts",
  "é.ts",
  "src/.hidden/a.ts",
  "a..b.ts",
  "plugins/discipline-core/core/values/repo-path.ts",
];

const REFUSED = [
  "",
  "/a.ts",
  "/home/user/repo/a.ts",
  ".",
  "..",
  "./a.ts",
  "a/./b.ts",
  "a/.",
  "../a.ts",
  "a/../b.ts",
  "a/..",
  "a//b.ts",
  "a/",
  "a\\b.ts",
  "C:\\repo\\a.ts",
  "C:/x",
  "c:/x",
  "C:x",
  "C:",
];

describe("isRepoPathText", () => {
  it.each(ACCEPTED)("holds for %j", (text) => {
    expect(isRepoPathText({ text })).toBe(true);
  });

  it.each(REFUSED)("does not hold for %j", (text) => {
    expect(isRepoPathText({ text })).toBe(false);
  });
});

describe("repoPathSchema", () => {
  it.each(ACCEPTED)("accepts %j", (text) => {
    expect(repoPathSchema.safeParse(text).success).toBe(true);
  });

  it.each(REFUSED)("refuses %j", (text) => {
    expect(repoPathSchema.safeParse(text).success).toBe(false);
  });

  it("parses a path to the same text", () => {
    expect(repoPathSchema.parse("src/é.ts")).toBe("src/é.ts");
  });
});
