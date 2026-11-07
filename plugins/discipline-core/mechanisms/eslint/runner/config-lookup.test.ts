import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { overlaidFileText } from "../../../tests/overlaid-file-text.ts";
import { teamConfigLookup } from "./config-lookup.ts";

const REPO = absolutePathSchema.parse("/repo");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const NEAREST = { outcome: "ok", value: { kind: "nearest-to-file" } };

const ROOT_CONFIG = { "/repo/eslint.config.mjs": "" };

const noFiles: FileTextPort = {
  read: ({ path: requested }) => ({ outcome: "failed", error: { kind: "unreadable", path: requested, detail: "absent" } }),
  exists: () => "absent",
  write: vi.fn<FileTextPort["write"]>(),
};

const eslintInstalled = (request: { readonly version: string }) => ({
  "/repo/node_modules/eslint/package.json": JSON.stringify({ version: request.version }),
});

const lintScript = (request: { readonly command: string }) => ({
  "/repo/package.json": JSON.stringify({ scripts: { lint: request.command } }),
});

const declaredLookup = (request: { readonly lookup: string }) => ({
  "/repo/disciplines.json": JSON.stringify({ eslintConfigLookup: request.lookup }),
});

const lookupOver = (request: { readonly files: Readonly<Record<string, string>> }) =>
  teamConfigLookup({
    fileText: overlaidFileText({ base: noFiles, files: request.files }),
    path,
    repoRoot: REPO,
    trackedPaths: [repoPathSchema.parse("package.json")],
  });

describe("teamConfigLookup", () => {
  it.each([
    { name: "ESLint 10", files: { ...eslintInstalled({ version: "10.11.0" }), ...ROOT_CONFIG } },
    { name: "an ESLint that is not installed at the repository root", files: ROOT_CONFIG },
    {
      name: "ESLint 9 started with --flag v10_config_lookup_from_file",
      files: {
        ...eslintInstalled({ version: "9.39.5" }),
        ...lintScript({ command: "eslint --flag v10_config_lookup_from_file ." }),
        ...ROOT_CONFIG,
      },
    },
    {
      name: "ESLint 9 started with --flag=unstable_config_lookup_from_file",
      files: {
        ...eslintInstalled({ version: "9.39.5" }),
        ...lintScript({ command: "pnpm exec eslint --flag=unstable_config_lookup_from_file ." }),
        ...ROOT_CONFIG,
      },
    },
  ])("looks configs up nearest to each file for $name", ({ files }) => {
    expect(lookupOver({ files })).toEqual(NEAREST);
  });

  it("looks only at the root config for ESLint 9 started without the lookup flag", () => {
    expect(
      lookupOver({ files: { ...eslintInstalled({ version: "9.39.5" }), ...lintScript({ command: "eslint ." }), ...ROOT_CONFIG } }),
    ).toEqual({
      outcome: "ok",
      value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
    });
  });

  it("fails as an unloadable team config when ESLint 9 would find no root config", () => {
    expect(lookupOver({ files: { ...eslintInstalled({ version: "9.39.5" }), ...lintScript({ command: "eslint ." }) } })).toMatchObject({
      outcome: "failed",
      error: { kind: "team-config-unloadable" },
    });
  });

  it("lets a declared nearest-to-file win over detecting a plain ESLint 9 run", () => {
    expect(
      lookupOver({
        files: {
          ...eslintInstalled({ version: "9.39.5" }),
          ...lintScript({ command: "turbo run lint" }),
          ...declaredLookup({ lookup: "nearest-to-file" }),
          ...ROOT_CONFIG,
        },
      }),
    ).toEqual(NEAREST);
  });

  it("lets a declared repository-root win over detecting ESLint 10", () => {
    expect(
      lookupOver({
        files: {
          ...eslintInstalled({ version: "10.11.0" }),
          ...lintScript({ command: "eslint ." }),
          ...declaredLookup({ lookup: "repository-root" }),
          ...ROOT_CONFIG,
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
    });
  });

  it("falls back to detection when the declaration is not one of the two settings", () => {
    expect(
      lookupOver({ files: { ...eslintInstalled({ version: "10.11.0" }), ...declaredLookup({ lookup: "anywhere" }), ...ROOT_CONFIG } }),
    ).toEqual(NEAREST);
  });
});
