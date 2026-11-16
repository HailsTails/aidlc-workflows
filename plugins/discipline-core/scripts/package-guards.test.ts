import { describe, expect, it } from "vitest";
import { deadLinksOf, misplacedEntriesOf, unbundledImportsOf, unlockedPackagesOf } from "./package-guards.ts";

const output = (request: {
  readonly path: string;
  readonly entryPoint?: string;
  readonly inputs?: readonly string[];
  readonly externalImports?: readonly string[];
}) => ({
  path: request.path,
  text: "",
  entryPoint: request.entryPoint,
  inputs: request.inputs ?? [],
  externalImports: request.externalImports ?? [],
});

describe("unbundledImportsOf", () => {
  it("accepts imports of node: builtins, of each peer and of each peer's subpaths", () => {
    expect(
      unbundledImportsOf({
        outputs: [
          output({
            path: "chunks/chunk-A.js",
            externalImports: ["node:fs", "eslint", "eslint/use-at-your-own-risk", "@typescript-eslint/eslint-plugin", "typescript"],
          }),
        ],
        peers: ["eslint", "@typescript-eslint/eslint-plugin", "typescript"],
      }),
    ).toEqual([]);
  });

  it("names each output that imports a package it neither bundles nor declares as a peer, and a bare builtin", () => {
    expect(
      unbundledImportsOf({
        outputs: [
          output({ path: "chunks/chunk-A.js", externalImports: ["levn", "eslint"] }),
          output({ path: "core/check/check-command.js", externalImports: ["fs", "@eslint/plugin-kit", "eslint-plugin-x"] }),
        ],
        peers: ["eslint"],
      }),
    ).toEqual([
      "chunks/chunk-A.js imports levn",
      "core/check/check-command.js imports fs",
      "core/check/check-command.js imports @eslint/plugin-kit",
      "core/check/check-command.js imports eslint-plugin-x",
    ]);
  });
});

describe("misplacedEntriesOf", () => {
  it("accepts entries emitted at their own path holding their own code", () => {
    expect(
      misplacedEntriesOf({
        entryPoints: ["mechanisms/eslint/runner/runner.ts"],
        outputs: [
          output({
            path: "mechanisms/eslint/runner/runner.js",
            entryPoint: "mechanisms/eslint/runner/runner.ts",
            inputs: ["mechanisms/eslint/runner/runner.ts"],
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("names an entry whose code another entry pulled into a shared chunk, and an entry with no output at its path", () => {
    expect(
      misplacedEntriesOf({
        entryPoints: ["mechanisms/eslint/runner/runner.ts", "core/check/check-command.ts"],
        outputs: [
          output({
            path: "mechanisms/eslint/runner/runner.js",
            entryPoint: "mechanisms/eslint/runner/runner.ts",
            inputs: [],
          }),
          output({ path: "chunks/chunk-A.js", inputs: ["mechanisms/eslint/runner/runner.ts"] }),
        ],
      }),
    ).toEqual([
      "mechanisms/eslint/runner/runner.ts is not emitted with its own code at mechanisms/eslint/runner/runner.js",
      "core/check/check-command.ts is not emitted with its own code at core/check/check-command.js",
    ]);
  });
});

const LOCK = JSON.stringify({
  lockfileVersion: 3,
  packages: {
    "": { version: "0.0.0" },
    "node_modules/zod": { version: "4.4.3" },
    "node_modules/levn": { version: "0.4.1" },
  },
});

describe("unlockedPackagesOf", () => {
  it("accepts packages bundled from core's own install at the versions its lock holds", () => {
    expect(
      unlockedPackagesOf({
        bundled: [
          { root: "node_modules/zod", name: "zod", version: "4.4.3" },
          { root: "node_modules/levn", name: "levn", version: "0.4.1" },
        ],
        lockText: LOCK,
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it("names a package bundled at another version, one the lock does not hold, and one from outside core's own install", () => {
    expect(
      unlockedPackagesOf({
        bundled: [
          { root: "node_modules/zod", name: "zod", version: "4.4.2" },
          { root: "node_modules/type-check", name: "type-check", version: "0.4.0" },
          { root: "../../node_modules/levn", name: "levn", version: "0.4.1" },
        ],
        lockText: LOCK,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        "zod 4.4.2 at node_modules/zod, but the lock holds 4.4.3",
        "type-check 0.4.0 at node_modules/type-check, which the lock does not hold",
        "levn 0.4.1 at ../../node_modules/levn, which the lock does not hold",
      ],
    });
  });

  it("fails when the lock is not an npm lock", () => {
    expect(unlockedPackagesOf({ bundled: [], lockText: "{}" })).toMatchObject({ outcome: "failed" });
  });
});

describe("deadLinksOf", () => {
  it("accepts links to shipped files and folders, anchors, and absolute URLs", () => {
    expect(
      deadLinksOf({
        files: [
          { path: "README.md", text: "[a](ADOPTING.md#2-install) [b](methods/) [c](https://example.com) [d](#runtime)" },
          { path: "ADOPTING.md", text: "[back](README.md)" },
          { path: "methods/README.md", text: "" },
          { path: "rules/CD-1/README.md", text: "[up](../../ADOPTING.md#9-apply)" },
        ],
      }),
    ).toEqual([]);
  });

  it("names each page link to a file the package does not ship", () => {
    expect(
      deadLinksOf({
        files: [
          { path: "README.md", text: "[a](tests/test-fixtures/walkthrough/) [b](MIGRATING.md)" },
          { path: "rules/CD-1/README.md", text: "[piece](../../mechanisms/eslint/CD-1/README.md)" },
          { path: "core/check/check-command.js", text: "[not](a-link.md)" },
        ],
      }),
    ).toEqual([
      "README.md links to tests/test-fixtures/walkthrough",
      "README.md links to MIGRATING.md",
      "rules/CD-1/README.md links to mechanisms/eslint/CD-1/README.md",
    ]);
  });
});
