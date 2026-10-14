import { describe, expect, it } from "vitest";
import { runnerFailureSchema } from "./runner-failure.ts";

describe("runnerFailureSchema", () => {
  it.each([
    { kind: "piece-invalid", pieceRoot: "mechanisms/walker/CD-14", detail: "no check export" },
    { kind: "tool-failed", detail: "eslint exited 2" },
    { kind: "file-unreadable", file: "src/a.ts", detail: "EACCES" },
    { kind: "plugin-conflict", detail: "two plugins named rin" },
    { kind: "team-config-unloadable", detail: "eslint.config.js threw" },
    { kind: "runner-invalid-output", detail: "hit has no snippet" },
    { kind: "file-unparseable", file: "src/a.ts", detail: "unexpected token" },
  ])("accepts a $kind failure", (failure) => {
    expect(runnerFailureSchema.safeParse(failure)).toEqual({
      success: true,
      data: failure,
    });
  });

  it("refuses an unknown failure kind", () => {
    expect(
      runnerFailureSchema.safeParse({ kind: "disk-full", detail: "no space" }).success,
    ).toBe(false);
  });

  it("refuses a failure with no detail", () => {
    expect(runnerFailureSchema.safeParse({ kind: "tool-failed" }).success).toBe(false);
  });

  it("refuses a piece-invalid failure with no piece root", () => {
    expect(
      runnerFailureSchema.safeParse({ kind: "piece-invalid", detail: "no check export" })
        .success,
    ).toBe(false);
  });

  it("refuses a file-unreadable failure whose file is not a repository path", () => {
    expect(
      runnerFailureSchema.safeParse({
        kind: "file-unreadable",
        file: "/etc/passwd",
        detail: "EACCES",
      }).success,
    ).toBe(false);
  });

  it("refuses a file-unparseable failure with no file", () => {
    expect(
      runnerFailureSchema.safeParse({ kind: "file-unparseable", detail: "unexpected token" })
        .success,
    ).toBe(false);
  });
});
