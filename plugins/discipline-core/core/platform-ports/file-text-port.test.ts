import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFileTextPort } from "./file-text-port.ts";

const created: string[] = [];

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "discipline-core-file-text-"));
  created.push(directory);
  return directory;
};

afterEach(() => {
  created.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("createFileTextPort", () => {
  it("reads a file's text as ok", () => {
    const path = join(newDirectory(), "a.ts");
    writeFileSync(path, "export const a = 1;\n");

    const result = createFileTextPort({}).read({ path });

    expect(result).toEqual({ outcome: "ok", value: "export const a = 1;\n" });
  });

  it("reads a missing file as unreadable with its path", () => {
    const path = join(newDirectory(), "missing.ts");

    const result = createFileTextPort({}).read({ path });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "unreadable", path },
    });
  });

  it("reads a missing file with a non-empty detail", () => {
    const path = join(newDirectory(), "missing.ts");

    const result = createFileTextPort({}).read({ path });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { detail: expect.stringMatching(/.+/) },
    });
  });

  it("reports an existing file as existing", () => {
    const path = join(newDirectory(), "a.ts");
    writeFileSync(path, "");

    expect(createFileTextPort({}).exists({ path })).toBe(true);
  });

  it("reports a missing file as not existing", () => {
    const path = join(newDirectory(), "missing.ts");

    expect(createFileTextPort({}).exists({ path })).toBe(false);
  });

  it("writes text that is then on disk", () => {
    const path = join(newDirectory(), "written.ts");

    createFileTextPort({}).write({ path, text: "written\n" });

    expect(readFileSync(path, "utf8")).toBe("written\n");
  });

  it("returns ok from a successful write", () => {
    const path = join(newDirectory(), "written.ts");

    const result = createFileTextPort({}).write({ path, text: "written\n" });

    expect(result).toEqual({ outcome: "ok", value: undefined });
  });

  it("writes into a missing directory as unwritable with its path", () => {
    const path = join(newDirectory(), "absent", "written.ts");

    const result = createFileTextPort({}).write({ path, text: "written\n" });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "unwritable", path, detail: expect.stringMatching(/.+/) },
    });
  });
});
