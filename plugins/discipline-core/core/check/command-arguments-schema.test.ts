import { describe, expect, it } from "vitest";
import { parseCheckArguments, parseProjectArguments } from "./command-arguments-schema.ts";

describe("parseCheckArguments", () => {
  it("reads --repo with no base revision", () => {
    expect(parseCheckArguments({ arguments: ["--repo", "/work/repo"] })).toEqual({
      outcome: "ok",
      value: { repo: "/work/repo", baseRevision: undefined },
    });
  });

  it("reads --repo and --base-revision", () => {
    expect(parseCheckArguments({ arguments: ["--repo", "/work/repo", "--base-revision", "origin/main"] })).toEqual({
      outcome: "ok",
      value: { repo: "/work/repo", baseRevision: "origin/main" },
    });
  });

  it("reads --base-revision given before --repo", () => {
    expect(parseCheckArguments({ arguments: ["--base-revision", "origin/main", "--repo", "/work/repo"] })).toEqual({
      outcome: "ok",
      value: { repo: "/work/repo", baseRevision: "origin/main" },
    });
  });

  it("is arguments-invalid with no arguments", () => {
    expect(parseCheckArguments({ arguments: [] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid without --repo", () => {
    expect(parseCheckArguments({ arguments: ["--base-revision", "origin/main"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for --repo with no value", () => {
    expect(parseCheckArguments({ arguments: ["--repo"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for --base-revision with no value", () => {
    expect(parseCheckArguments({ arguments: ["--repo", "/work/repo", "--base-revision"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for an unknown option", () => {
    expect(parseCheckArguments({ arguments: ["--repo", "/work/repo", "--fix"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for a stray positional argument", () => {
    expect(parseCheckArguments({ arguments: ["--repo", "/work/repo", "src"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for --repo given twice", () => {
    expect(parseCheckArguments({ arguments: ["--repo", "/work/repo", "--repo", "/other/repo"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for the --repo=<dir> form", () => {
    expect(parseCheckArguments({ arguments: ["--repo=/work/repo"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });
});

describe("parseProjectArguments", () => {
  it("reads --repo", () => {
    expect(parseProjectArguments({ arguments: ["--repo", "/work/repo"] })).toEqual({
      outcome: "ok",
      value: { repo: "/work/repo" },
    });
  });

  it("is arguments-invalid without --repo", () => {
    expect(parseProjectArguments({ arguments: [] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for --base-revision, which only the check command takes", () => {
    expect(parseProjectArguments({ arguments: ["--repo", "/work/repo", "--base-revision", "origin/main"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });

  it("is arguments-invalid for an unknown option", () => {
    expect(parseProjectArguments({ arguments: ["--repo", "/work/repo", "--fix"] })).toMatchObject({
      outcome: "failed",
      error: { kind: "arguments-invalid" },
    });
  });
});
