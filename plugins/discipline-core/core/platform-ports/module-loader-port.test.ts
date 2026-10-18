import { describe, expect, it, vi } from "vitest";
import { createModuleLoaderPort, type ImportModule } from "./module-loader-port.ts";

const PATH = "/install/mechanisms/walker/runner/runner.ts";

describe("createModuleLoaderPort", () => {
  it("returns the imported namespace as ok", async () => {
    const loadOutcome = await createModuleLoaderPort({
      importModule: vi.fn<ImportModule>().mockResolvedValue({ marker: "loaded" }),
    }).load({ path: PATH });

    expect(loadOutcome).toEqual({ outcome: "ok", value: { marker: "loaded" } });
  });

  it("imports the requested path", async () => {
    const importModule = vi.fn<ImportModule>().mockResolvedValue({});

    await createModuleLoaderPort({ importModule }).load({ path: PATH });

    expect(importModule).toHaveBeenCalledWith({ path: "/install/mechanisms/walker/runner/runner.ts" });
  });

  it("loads as module-unloadable with the path and message when the import rejects", async () => {
    const loadOutcome = await createModuleLoaderPort({
      importModule: vi.fn<ImportModule>().mockRejectedValue(new Error("evaluation failed")),
    }).load({ path: PATH });

    expect(loadOutcome).toEqual({
      outcome: "failed",
      error: {
        kind: "module-unloadable",
        path: "/install/mechanisms/walker/runner/runner.ts",
        detail: "evaluation failed",
      },
    });
  });
});
