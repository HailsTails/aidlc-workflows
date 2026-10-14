import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createModuleLoaderPort } from "./module-loader-port.ts";

const created: string[] = [];

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "discipline-core-module-"));
  created.push(directory);
  return directory;
};

afterEach(() => {
  created.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("createModuleLoaderPort", () => {
  it("loads a TypeScript module and returns its namespace", async () => {
    const path = join(newDirectory(), "probe-module.ts");
    writeFileSync(path, 'export const marker: string = "loaded";\n');

    const result = await createModuleLoaderPort({}).load({ path });

    expect(result).toMatchObject({
      outcome: "ok",
      value: { marker: "loaded" },
    });
  });

  it("loads a missing file as module-unloadable with its path", async () => {
    const path = join(newDirectory(), "missing-module.ts");

    const result = await createModuleLoaderPort({}).load({ path });

    expect(result).toMatchObject({
      outcome: "failed",
      error: {
        kind: "module-unloadable",
        path,
        detail: expect.stringMatching(/.+/),
      },
    });
  });

  it("loads a module that throws on evaluation as module-unloadable", async () => {
    const path = join(newDirectory(), "throwing-module.ts");
    writeFileSync(path, 'throw new Error("evaluation failed");\n');

    const result = await createModuleLoaderPort({}).load({ path });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "module-unloadable", path },
    });
  });
});
