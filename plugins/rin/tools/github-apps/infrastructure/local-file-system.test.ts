import { afterEach, assert, describe, expect, it } from "vitest";
import {
  createPrivateFile,
  createPrivateFileReplacer,
  moveFile,
  readTextFile,
  removeFile,
  resolveCanonicalPath,
} from "./local-file-system.ts";

const replacePrivateFile = createPrivateFileReplacer({
  createTemporaryName: () => globalThis.crypto.randomUUID(),
});

const ownSource = new URL("./local-file-system.ts", import.meta.url);

const absentFile = new URL("./absent-file.json", import.meta.url);

const ignoredDirectory = `${import.meta.dirname}/../../../../../node_modules`;

const scratchLocation = () =>
  `${ignoredDirectory}/rin-github-apps-local-file-system-${globalThis.crypto.randomUUID()}.json`;

const absentDirectoryLocation = `${import.meta.dirname}/absent-directory/private.json`;

const scratchLocations: string[] = [];

const freshScratchLocation = (): string => {
  const location = scratchLocation();
  scratchLocations.push(location);
  return location;
};

afterEach(async () => {
  await Promise.all(scratchLocations.splice(0).map((location) => removeFile(location)));
});

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

    const canonical = await resolveCanonicalPath(
      `${ownDirectory}/../infrastructure/local-file-system.ts`,
    );

    assert(canonical.kind === "success");
    expect(canonical.outcome).not.toContain("..");
    expect(canonical.outcome).toMatch(/local-file-system\.ts$/);
  });

  it("reports a path that does not exist", async () => {
    expect(await resolveCanonicalPath("absent-directory/absent-file.md")).toEqual({
      kind: "failure",
      reason: { kind: "file-unreadable", location: "absent-directory/absent-file.md" },
    });
  });
});

describe("replacePrivateFile", () => {
  it("writes a file that did not exist", async () => {
    const location = freshScratchLocation();

    const replaced = await replacePrivateFile({ location, text: '{"grant":1}\n' });

    expect(replaced).toEqual({ kind: "success", outcome: undefined });
    expect(await readTextFile(location)).toEqual({ kind: "success", outcome: '{"grant":1}\n' });
  });

  it("replaces the whole text of a file that exists", async () => {
    const location = freshScratchLocation();
    await replacePrivateFile({ location, text: "first and longer text" });

    await replacePrivateFile({ location, text: "second" });

    expect(await readTextFile(location)).toEqual({ kind: "success", outcome: "second" });
  });

  it("reports a location it cannot write, with the runtime's reason", async () => {
    const replaced = await replacePrivateFile({ location: absentDirectoryLocation, text: "x" });

    assert(replaced.kind === "failure");
    expect(replaced.reason.kind).toBe("file-unwritable");
    expect(replaced.reason.location).toBe(absentDirectoryLocation);
    expect(replaced.reason.detail).toContain("ENOENT");
  });
});

describe("createPrivateFile", () => {
  it("creates a file that did not exist", async () => {
    const location = freshScratchLocation();

    const created = await createPrivateFile({ location, text: "1700000120" });

    expect(created).toEqual({ kind: "success", outcome: undefined });
    expect(await readTextFile(location)).toEqual({ kind: "success", outcome: "1700000120" });
  });

  it("refuses to overwrite a file that exists", async () => {
    const location = freshScratchLocation();
    await createPrivateFile({ location, text: "held" });

    const created = await createPrivateFile({ location, text: "taken" });

    expect(created).toEqual({ kind: "failure", reason: { kind: "file-already-exists", location } });
    expect(await readTextFile(location)).toEqual({ kind: "success", outcome: "held" });
  });

  it("reports a location it cannot write", async () => {
    const created = await createPrivateFile({ location: absentDirectoryLocation, text: "x" });

    assert(created.kind === "failure" && created.reason.kind === "file-unwritable");
    expect(created.reason.location).toBe(absentDirectoryLocation);
    expect(created.reason.detail).toContain("ENOENT");
  });
});

describe("removeFile", () => {
  it("removes a file", async () => {
    const location = freshScratchLocation();
    await createPrivateFile({ location, text: "held" });

    const removed = await removeFile(location);

    expect(removed).toEqual({ kind: "success", outcome: undefined });
    expect((await readTextFile(location)).kind).toBe("failure");
  });

  it("treats a file that is already gone as removed", async () => {
    expect(await removeFile(freshScratchLocation())).toEqual({
      kind: "success",
      outcome: undefined,
    });
  });

  it("reports a location it cannot remove", async () => {
    const removed = await removeFile(import.meta.dirname);

    assert(removed.kind === "failure");
    expect(removed.reason).toEqual({
      kind: "file-unwritable",
      location: import.meta.dirname,
      detail: expect.any(String),
    });
  });
});

describe("moveFile", () => {
  it("moves a file to a new name, leaving nothing at the old one", async () => {
    const from = freshScratchLocation();
    const to = freshScratchLocation();
    await createPrivateFile({ location: from, text: "held" });

    const moved = await moveFile({ from, to });

    expect(moved).toEqual({ kind: "success", outcome: undefined });
    expect(await readTextFile(to)).toEqual({ kind: "success", outcome: "held" });
    expect((await readTextFile(from)).kind).toBe("failure");
  });

  it("reports a file that is no longer there to move", async () => {
    const from = freshScratchLocation();

    const moved = await moveFile({ from, to: freshScratchLocation() });

    expect(moved).toEqual({ kind: "failure", reason: { kind: "file-missing", location: from } });
  });
});
