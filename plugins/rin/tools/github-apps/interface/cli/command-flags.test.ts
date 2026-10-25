import { assert, describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, succeed } from "../../domain/result.ts";
import { parseCommandFlags, validateFlags } from "./command-flags.ts";

describe("parseCommandFlags", () => {
  it("pairs each flag with its value and marks bare flags present", () => {
    expect(parseCommandFlags(["--title", "Add the basket", "--draft", "--base", "main"])).toEqual(
      succeed({ title: "Add the basket", draft: true, base: "main" }),
    );
  });

  it("ignores the separator pnpm forwards before script arguments", () => {
    expect(parseCommandFlags(["--", "--pr", "4"])).toEqual(succeed({ pr: "4" }));
  });

  it("marks a trailing flag present", () => {
    expect(parseCommandFlags(["--pr", "4", "--draft"])).toEqual(succeed({ pr: "4", draft: true }));
  });

  it("refuses a flag given twice so a later one cannot silently win", () => {
    expect(parseCommandFlags(["--pr", "4", "--pr", "5"])).toEqual(
      fail({ kind: "flag-repeated", flag: "pr" }),
    );
  });

  it("refuses a stray positional argument", () => {
    expect(parseCommandFlags(["--pr", "4", "5"])).toEqual(
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
