import { describe, expect, it } from "vitest";
import {
  builtModulePath,
  externalPeersOf,
  packagePlanOf,
  piecePathsIn,
  thirdPartyNoticesOf,
} from "./package-plan.ts";

const SOURCE_PATHS = [
  "README.md",
  "ADOPTING.md",
  "MIGRATING.md",
  "LICENSE",
  "package.json",
  "docs/why-chain-contract.md",
  "docs/adding-a-discipline-or-mechanism.md",
  "core/check/check-command.ts",
  "core/check/check-command.test.ts",
  "core/check/project-command.ts",
  "core/check/run-check.ts",
  "mechanisms/audit/runner/runner.ts",
  "mechanisms/audit/runner/runner.test.ts",
  "mechanisms/audit/runner/piece-type-packages.json",
  "mechanisms/audit/runner/README.md",
  "mechanisms/audit/CD-23/piece.json",
  "mechanisms/audit/CD-23/export-test-sibling.ts",
  "mechanisms/eslint/runner/runner.ts",
  "mechanisms/eslint/CD-14/piece.json",
  "mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
  "mechanisms/eslint/CD-14/README.md",
  "mechanisms/eslint/runner/test-fixtures/x/piece.json",
  "rules/README.md",
  "rules/CD-14/README.md",
  "rules/CD-14/discipline.json",
  "methods/README.md",
  "methods/lenses/naming.md",
  "tests/probe-rule-set/mechanisms/audit/PD-1/piece.json",
  "tests/walkthrough.integration.test.ts",
];

const AUDIT_PIECE = {
  path: "mechanisms/audit/CD-23/piece.json",
  text: '{ "version": 1, "discipline": "CD-23", "mechanism": "audit", "clauses": [ { "clause": "export-test-sibling", "settings": { "module": "export-test-sibling.ts" } } ] }',
};

const ESLINT_PIECE = {
  path: "mechanisms/eslint/CD-14/piece.json",
  text: JSON.stringify({
    version: 1,
    discipline: "CD-14",
    mechanism: "eslint",
    clauses: [
      { clause: "class-syntax", settings: { pluginNamespace: "discipline", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class" } },
      { clause: "static-only-class", settings: { pluginNamespace: "discipline", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "static" } },
    ],
  }),
};

describe("piecePathsIn", () => {
  it("lists the shipped pieces' piece.json files, never a runner folder, a test fixture or the probe rule set", () => {
    expect(piecePathsIn({ sourcePaths: SOURCE_PATHS })).toEqual([
      "mechanisms/audit/CD-23/piece.json",
      "mechanisms/eslint/CD-14/piece.json",
    ]);
  });
});

describe("packagePlanOf", () => {
  const plan = packagePlanOf({ sourcePaths: SOURCE_PATHS, pieces: [AUDIT_PIECE, ESLINT_PIECE] });

  it("builds the two commands, each runner and each piece module a shipped piece names, once each", () => {
    expect(plan).toMatchObject({
      outcome: "ok",
      value: {
        entryPoints: [
          "core/check/check-command.ts",
          "core/check/project-command.ts",
          "mechanisms/audit/runner/runner.ts",
          "mechanisms/eslint/runner/runner.ts",
          "mechanisms/audit/CD-23/export-test-sibling.ts",
          "mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
        ],
        commands: { check: "core/check/check-command.js", project: "core/check/project-command.js" },
      },
    });
  });

  it("copies the documents, rule pages, rule data and review methods, and nothing the check never reads or a test owns", () => {
    expect(plan).toMatchObject({
      outcome: "ok",
      value: {
        copied: [
          "README.md",
          "ADOPTING.md",
          "LICENSE",
          "docs/why-chain-contract.md",
          "rules/README.md",
          "rules/CD-14/README.md",
          "rules/CD-14/discipline.json",
          "methods/README.md",
          "methods/lenses/naming.md",
        ],
      },
    });
  });

  it("rewrites each shipped piece's module paths to the built .js modules and keeps every other setting", () => {
    expect(plan).toMatchObject({
      outcome: "ok",
      value: {
        pieces: [
          {
            path: "mechanisms/audit/CD-23/piece.json",
            text: `${JSON.stringify(
              {
                version: 1,
                discipline: "CD-23",
                mechanism: "audit",
                clauses: [{ clause: "export-test-sibling", settings: { module: "export-test-sibling.js" } }],
              },
              null,
              2,
            )}\n`,
          },
          {
            path: "mechanisms/eslint/CD-14/piece.json",
            text: expect.stringContaining('"pluginModule": "cd14/cd14.eslint-plugin.js",\n        "rule": "no-class"'),
          },
        ],
      },
    });
  });

  it("is piece-invalid naming the piece when a piece.json is not JSON", () => {
    expect(packagePlanOf({ sourcePaths: SOURCE_PATHS, pieces: [{ path: AUDIT_PIECE.path, text: "{ clauses" }] })).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", path: AUDIT_PIECE.path },
    });
  });

  it("is piece-invalid naming the piece when a piece.json has no clauses", () => {
    expect(packagePlanOf({ sourcePaths: SOURCE_PATHS, pieces: [{ path: AUDIT_PIECE.path, text: "{}" }] })).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", path: AUDIT_PIECE.path },
    });
  });
});

describe("builtModulePath", () => {
  it("swaps a source module's .ts for the built .js", () => {
    expect(builtModulePath({ path: "cd1/cd1.eslint-plugin.ts" })).toBe("cd1/cd1.eslint-plugin.js");
  });

  it("keeps a path that names no source module", () => {
    expect(builtModulePath({ path: "rules/CD-1/discipline.json" })).toBe("rules/CD-1/discipline.json");
  });
});

describe("externalPeersOf", () => {
  it("keeps each peer and every subpath of it outside the bundle", () => {
    expect(externalPeersOf({ peers: ["eslint", "@typescript-eslint/parser"] })).toEqual([
      "eslint",
      "eslint/*",
      "@typescript-eslint/parser",
      "@typescript-eslint/parser/*",
    ]);
  });
});

describe("thirdPartyNoticesOf", () => {
  it("reproduces each bundled package's licence by name order, and its NOTICE where it has one", () => {
    expect(
      thirdPartyNoticesOf({
        packages: [
          { name: "zod", version: "4.4.3", license: "MIT", licenseText: "MIT text\n", noticeText: undefined },
          { name: "@eslint/plugin-kit", version: "0.7.3", license: "Apache-2.0", licenseText: "Apache text\n", noticeText: "Notice text\n" },
        ],
      }),
    ).toBe(
      [
        "# Third-party notices",
        "",
        "This package bundles the following packages into its JavaScript: esbuild combined and re-emitted their code, without changing what it does. Each is redistributed under its own licence, reproduced below.",
        "",
        "## @eslint/plugin-kit 0.7.3",
        "",
        "License: Apache-2.0",
        "",
        "```text",
        "Apache text",
        "```",
        "",
        "NOTICE:",
        "",
        "```text",
        "Notice text",
        "```",
        "",
        "## zod 4.4.3",
        "",
        "License: MIT",
        "",
        "```text",
        "MIT text",
        "```",
        "",
      ].join("\n"),
    );
  });
});
