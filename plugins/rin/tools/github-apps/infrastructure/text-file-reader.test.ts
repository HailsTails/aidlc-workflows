import { assert, describe, expect, it } from "vitest";
import { readTextFile, resolveCanonicalPath } from "./text-file-reader.ts";

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

describe("resolveCanonicalPath", () => {
  it("resolves a relative path through its parent directory to one absolute path", async () => {
    const ownDirectory = import.meta.dirname;

    const canonical = await resolveCanonicalPath(`${ownDirectory}/../infrastructure/text-file-reader.ts`);

    assert(canonical.kind === "success");
    expect(canonical.outcome).not.toContain("..");
    expect(canonical.outcome).toMatch(/text-file-reader\.ts$/);
  });

  it("reports a path that does not exist", async () => {
    expect(await resolveCanonicalPath("absent-directory/absent-file.md")).toEqual({
      kind: "failure",
      reason: { kind: "file-unreadable", location: "absent-directory/absent-file.md" },
    });
  });
});
