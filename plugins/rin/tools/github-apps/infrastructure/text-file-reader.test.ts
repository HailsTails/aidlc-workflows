import { assert, describe, expect, it } from "vitest";
import { readTextFile } from "./text-file-reader.ts";

const ownSource = new URL("./text-file-reader.ts", import.meta.url);

const absentFile = new URL("./absent-file.json", import.meta.url);

describe("readTextFile", () => {
  it("reads a file's text", async () => {
    const sourceText = await readTextFile(ownSource);

    assert(sourceText.kind === "success");
    expect(sourceText.outcome).toContain("const readTextFile");
  });

  it("reports a file it cannot read, naming where it looked", async () => {
    expect(await readTextFile(absentFile)).toEqual({
      kind: "failure",
      reason: { kind: "file-unreadable", location: absentFile.href },
    });
  });
});
