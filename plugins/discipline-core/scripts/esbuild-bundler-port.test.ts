import { describe, expect, it } from "vitest";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createEsbuildBundlerPort } from "./esbuild-bundler-port.ts";

const SOURCE_ROOT = `${import.meta.dirname}/..`;

const bundler = createEsbuildBundlerPort({ path: createDefaultPathPort({}) });

describe("createEsbuildBundlerPort bundle", () => {
  it("emits each entry at its own repository path with its inputs and the imports it left external", async () => {
    const bundled = await bundler.bundle({
      sourceRoot: SOURCE_ROOT,
      entryPoints: ["core/platform-ports/module-loader-port.ts"],
      external: [],
      target: "node22",
    });

    expect(bundled).toEqual({
      outcome: "ok",
      value: {
        outputs: [
          {
            path: "core/platform-ports/module-loader-port.js",
            text: expect.any(String),
            entryPoint: "core/platform-ports/module-loader-port.ts",
            inputs: ["core/platform-ports/module-loader-port.ts"],
            externalImports: ["node:url"],
          },
        ],
        packageRoots: [],
      },
    });
  });

  it("keeps the requested externals out of the bundle", async () => {
    const bundled = await bundler.bundle({
      sourceRoot: SOURCE_ROOT,
      entryPoints: ["core/platform-ports/execution-port.ts"],
      external: ["zod"],
      target: "node22",
    });

    expect(bundled).toEqual({
      outcome: "ok",
      value: {
        outputs: [
          {
            path: "core/platform-ports/execution-port.js",
            text: expect.any(String),
            entryPoint: "core/platform-ports/execution-port.ts",
            inputs: ["core/platform-ports/execution-port.ts"],
            externalImports: ["node:child_process", "zod"],
          },
        ],
        packageRoots: [],
      },
    });
  });

  it("returns bundle-failed when an entry cannot be bundled", async () => {
    const bundled = await bundler.bundle({
      sourceRoot: SOURCE_ROOT,
      entryPoints: ["core/platform-ports/absent-port.ts"],
      external: [],
      target: "node22",
    });

    expect(bundled).toEqual({ outcome: "failed", error: { kind: "bundle-failed", detail: expect.any(String) } });
  });
});
