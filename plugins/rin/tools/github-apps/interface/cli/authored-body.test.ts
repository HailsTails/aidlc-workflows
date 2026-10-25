import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../../domain/result.ts";
import type { BodyFileReader } from "../../application/read-body-file.ts";
import { readOptionalBody, readRequiredBody } from "./authored-body.ts";

const reading = (fileText: string) => vi.fn<BodyFileReader>().mockResolvedValue(succeed(fileText));

describe("readOptionalBody", () => {
  it("takes an inline body as written", async () => {
    expect(
      await readOptionalBody({
        inlineBody: "Short.",
        bodyFile: undefined,
        readBodyFile: reading(""),
      }),
    ).toEqual(succeed("Short."));
  });

  it("reads a body file", async () => {
    const readBodyFile = reading("## Summary\n\nLong body.");

    expect(
      await readOptionalBody({ inlineBody: undefined, bodyFile: "body.md", readBodyFile }),
    ).toEqual(succeed("## Summary\n\nLong body."));
    expect(readBodyFile).toHaveBeenCalledExactlyOnceWith("body.md");
  });

  it("is absent when neither is given", async () => {
    expect(
      await readOptionalBody({
        inlineBody: undefined,
        bodyFile: undefined,
        readBodyFile: reading(""),
      }),
    ).toEqual(succeed(undefined));
  });

  it("refuses both at once", async () => {
    expect(
      await readOptionalBody({
        inlineBody: "Short.",
        bodyFile: "body.md",
        readBodyFile: reading(""),
      }),
    ).toEqual(fail({ kind: "body-given-twice" }));
  });

  it("reports a body file it cannot read", async () => {
    const readBodyFile = vi
      .fn<BodyFileReader>()
      .mockResolvedValue(fail({ kind: "body-file-unreadable", location: "body.md" }));

    expect(
      await readOptionalBody({ inlineBody: undefined, bodyFile: "body.md", readBodyFile }),
    ).toEqual(fail({ kind: "body-file-unreadable", location: "body.md" }));
  });
});

describe("readRequiredBody", () => {
  it("refuses a blank body", async () => {
    expect(
      await readRequiredBody({ inlineBody: "  ", bodyFile: undefined, readBodyFile: reading("") }),
    ).toEqual(fail({ kind: "body-missing" }));
  });

  it("refuses no body at all", async () => {
    expect(
      await readRequiredBody({
        inlineBody: undefined,
        bodyFile: undefined,
        readBodyFile: reading(""),
      }),
    ).toEqual(fail({ kind: "body-missing" }));
  });
});
