import { describe, expect, it } from "vitest";
import { rejectedCall, runnerFailureSchema, runnerInvalidOutput } from "./runner-failure.ts";

describe("runnerFailureSchema", () => {
  it.each([
    { kind: "piece-invalid", pieceRoot: "mechanisms/audit/CD-14", detail: "no check export" },
    { kind: "tool-failed", detail: "eslint exited 2" },
    { kind: "file-unreadable", file: "src/a.ts", detail: "EACCES" },
    { kind: "plugin-conflict", detail: "two plugins named team" },
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

describe("runnerInvalidOutput", () => {
  it("is a failed runner-invalid-output carrying the detail it is given", () => {
    expect(runnerInvalidOutput({ detail: "x" })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "x" },
    });
  });
});

describe("rejectedCall", () => {
  it("is runner-invalid-output naming the message of a thrown Error", () => {
    expect(rejectedCall({ thrown: new Error("boom") })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "the runner call threw or rejected: boom" },
    });
  });

  it("is runner-invalid-output naming the text of a thrown value that is not an Error", () => {
    expect(rejectedCall({ thrown: 7 })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "the runner call threw or rejected: 7" },
    });
  });
});
