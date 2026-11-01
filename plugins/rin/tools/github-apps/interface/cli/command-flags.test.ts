import { assert, describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, succeed } from "../../domain/result.ts";
import { parseCommandFlags, validateFlags } from "./command-flags.ts";

describe("parseCommandFlags", () => {
  it("pairs each flag with its value and marks bare flags present", () => {
    expect(parseCommandFlags({ tokens: ["--title", "Add the basket", "--draft", "--base", "main"], repeatableFlags: [] })).toEqual(
      succeed({ title: "Add the basket", draft: true, base: "main" }),
    );
  });

  it("ignores the separator pnpm forwards before script arguments", () => {
    expect(parseCommandFlags({ tokens: ["--", "--pr", "4"], repeatableFlags: [] })).toEqual(succeed({ pr: "4" }));
  });

  it("marks a trailing flag present", () => {
    expect(parseCommandFlags({ tokens: ["--pr", "4", "--draft"], repeatableFlags: [] })).toEqual(succeed({ pr: "4", draft: true }));
  });

  it("refuses a flag given twice so a later one cannot silently win", () => {
    expect(parseCommandFlags({ tokens: ["--pr", "4", "--pr", "5"], repeatableFlags: [] })).toEqual(
      fail({ kind: "flag-repeated", flag: "pr" }),
    );
  });

  it("collects every value of a repeatable flag in order", () => {
    expect(
      parseCommandFlags({
        tokens: ["--label", "bug", "--title", "T", "--label", "stage:triage"],
        repeatableFlags: ["label"],
      }),
    ).toEqual(succeed({ label: ["bug", "stage:triage"], title: "T" }));
  });

  it("collects a repeatable flag given once as a single-value list", () => {
    expect(parseCommandFlags({ tokens: ["--label", "bug"], repeatableFlags: ["label"] })).toEqual(
      succeed({ label: ["bug"] }),
    );
  });

  it("refuses a repeatable flag without a value", () => {
    expect(
      parseCommandFlags({ tokens: ["--label", "--title", "T"], repeatableFlags: ["label"] }),
    ).toEqual(fail({ kind: "flag-value-missing", flag: "label" }));
  });

  it("still refuses repeating a flag the command does not declare repeatable", () => {
    expect(
      parseCommandFlags({ tokens: ["--title", "A", "--title", "B"], repeatableFlags: ["label"] }),
    ).toEqual(fail({ kind: "flag-repeated", flag: "title" }));
  });

  it("refuses a stray positional argument", () => {
    expect(parseCommandFlags({ tokens: ["--pr", "4", "5"], repeatableFlags: [] })).toEqual(
      fail({ kind: "flag-malformed", token: "5" }),
    );
  });
});

describe("validateFlags", () => {
  const schema = z.strictObject({ pr: z.string().regex(/^\d+$/).transform(Number) });

  it("shapes valid flags through the command's schema", () => {
    expect(validateFlags({ flags: { pr: "4" }, schema })).toEqual(succeed({ pr: 4 }));
  });

  it("refuses an unknown flag", () => {
    const validated = validateFlags({ flags: { pr: "4", rpo: "x" }, schema });

    assert(validated.kind === "failure" && validated.reason.kind === "flags-invalid");
    expect(validated.reason.issues).toContain("rpo");
  });
});
