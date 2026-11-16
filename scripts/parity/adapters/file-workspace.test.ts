import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileWorkspace } from "./file-workspace.ts";

const SCRATCH = mkdtempSync(join(import.meta.dir, "../../../.cache/gate-tests-workspace-"));

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

describe("fileWorkspace.read", () => {
  test("a file is read and a folder or missing path is not", () => {
    mkdirSync(join(SCRATCH, "folder"));
    writeFileSync(join(SCRATCH, "file.txt"), "text");
    const workspace = fileWorkspace(SCRATCH);

    expect(workspace.read("file.txt")).toBe("text");
    expect(workspace.read("folder")).toBeUndefined();
    expect(workspace.read("missing")).toBeUndefined();
  });
});
