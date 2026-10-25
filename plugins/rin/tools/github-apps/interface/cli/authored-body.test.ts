import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../../domain/result.ts";
import type { TextFileReader } from "../../infrastructure/text-file-reader.ts";
import { readOptionalBody, readRequiredBody } from "./authored-body.ts";

const reading = (fileText: string) => vi.fn<TextFileReader>().mockResolvedValue(succeed(fileText));

describe("readOptionalBody", () => {
  it("takes an inline body as written", async () => {
    expect(
      await readOptionalBody({
        inlineBody: "Short.",
        bodyFile: undefined,
        readTextFile: reading(""),
      }),
    ).toEqual(succeed("Short."));
  });

  it("reads a body file", async () => {
    const readTextFile = reading("## Summary\n\nLong body.");

    expect(
      await readOptionalBody({ inlineBody: undefined, bodyFile: "body.md", readTextFile }),
    ).toEqual(succeed("## Summary\n\nLong body."));
    expect(readTextFile).toHaveBeenCalledExactlyOnceWith("body.md");
  });

  it("is absent when neither is given", async () => {
    expect(
      await readOptionalBody({
        inlineBody: undefined,
        bodyFile: undefined,
        readTextFile: reading(""),
      }),
    ).toEqual(succeed(undefined));
  });

  it("refuses both at once", async () => {
    expect(
      await readOptionalBody({
        inlineBody: "Short.",
        bodyFile: "body.md",
        readTextFile: reading(""),
      }),
    ).toEqual(fail({ kind: "body-given-twice" }));
  });

  it("reports a body file it cannot read", async () => {
    const readTextFile = vi
      .fn<TextFileReader>()
      .mockResolvedValue(fail({ kind: "file-unreadable", location: "body.md" }));

    expect(
      await readOptionalBody({ inlineBody: undefined, bodyFile: "body.md", readTextFile }),
    ).toEqual(fail({ kind: "body-file-unreadable", location: "body.md" }));
  });
});

describe("readRequiredBody", () => {
  it("refuses a blank body", async () => {
    expect(
      await readRequiredBody({ inlineBody: "  ", bodyFile: undefined, readTextFile: reading("") }),
    ).toEqual(fail({ kind: "body-missing" }));
  });

  it("refuses no body at all", async () => {
    expect(
      await readRequiredBody({
        inlineBody: undefined,
        bodyFile: undefined,
        readTextFile: reading(""),
      }),
    ).toEqual(fail({ kind: "body-missing" }));
  });
});
