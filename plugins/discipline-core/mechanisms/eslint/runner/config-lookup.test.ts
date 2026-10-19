import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { teamConfigLookup } from "./config-lookup.ts";

const REPO = absolutePathSchema.parse("/repo");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const NEAREST = { outcome: "ok", value: { kind: "nearest-to-file" } };

const fileTextOver = (request: { readonly files: Readonly<Record<string, string>> }): FileTextPort => ({
  read: ({ path: requested }) => {
    const text = request.files[requested];
    return text === undefined
      ? { outcome: "failed", error: { kind: "unreadable", path: requested, detail: "absent" } }
      : { outcome: "ok", value: text };
  },
  exists: ({ path: requested }) => (request.files[requested] === undefined ? "absent" : "present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const lookupOver = (request: {
  readonly eslintVersion?: string;
  readonly lintScript?: string;
  readonly rootConfig?: string;
  readonly declared?: string;
}) =>
  teamConfigLookup({
    fileText: fileTextOver({
      files: {
        ...(request.eslintVersion === undefined
          ? {}
          : { "/repo/node_modules/eslint/package.json": JSON.stringify({ version: request.eslintVersion }) }),
        ...(request.lintScript === undefined
          ? {}
          : { "/repo/package.json": JSON.stringify({ scripts: { lint: request.lintScript } }) }),
        ...(request.declared === undefined
          ? {}
          : { "/repo/disciplines.json": JSON.stringify({ eslintConfigLookup: request.declared }) }),
        ...(request.rootConfig === undefined ? {} : { [`/repo/${request.rootConfig}`]: "" }),
      },
    }),
    path,
    repoRoot: REPO,
    trackedPaths: [repoPathSchema.parse("package.json")],
  });

describe("teamConfigLookup", () => {
  it.each([
    { name: "ESLint 10", eslintVersion: "10.11.0" },
    { name: "an ESLint that is not installed at the repository root", eslintVersion: undefined },
    { name: "ESLint 9 started with --flag v10_config_lookup_from_file", eslintVersion: "9.39.5", lintScript: "eslint --flag v10_config_lookup_from_file ." },
    { name: "ESLint 9 started with --flag=unstable_config_lookup_from_file", eslintVersion: "9.39.5", lintScript: "pnpm exec eslint --flag=unstable_config_lookup_from_file ." },
  ])("looks configs up nearest to each file for $name", ({ name: _name, ...team }) => {
    expect(lookupOver({ ...team, rootConfig: "eslint.config.mjs" })).toEqual(NEAREST);
  });

  it("looks only at the root config for ESLint 9 started without the lookup flag", () => {
    expect(lookupOver({ eslintVersion: "9.39.5", lintScript: "eslint .", rootConfig: "eslint.config.mjs" })).toEqual({
      outcome: "ok",
      value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
    });
  });

  it("fails as an unloadable team config when ESLint 9 would find no root config", () => {
    expect(lookupOver({ eslintVersion: "9.39.5", lintScript: "eslint ." })).toMatchObject({
      outcome: "failed",
      error: { kind: "team-config-unloadable" },
    });
  });

  it("lets a declared nearest-to-file win over detecting a plain ESLint 9 run", () => {
    expect(
      lookupOver({ eslintVersion: "9.39.5", lintScript: "turbo run lint", rootConfig: "eslint.config.mjs", declared: "nearest-to-file" }),
    ).toEqual(NEAREST);
  });

  it("lets a declared repository-root win over detecting ESLint 10", () => {
    expect(lookupOver({ eslintVersion: "10.11.0", lintScript: "eslint .", rootConfig: "eslint.config.mjs", declared: "repository-root" })).toEqual({
      outcome: "ok",
      value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
    });
  });

  it("falls back to detection when the declaration is not one of the two settings", () => {
    expect(lookupOver({ eslintVersion: "10.11.0", rootConfig: "eslint.config.mjs", declared: "anywhere" })).toEqual(NEAREST);
  });
});
