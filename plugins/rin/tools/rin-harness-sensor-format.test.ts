import { describe, expect, test } from "vitest";
import {
  biomeFormatCommand,
  FORMATTED_EXTENSIONS,
  installedProjectTool,
  targetPathFrom,
} from "./rin-harness-sensor-format.ts";

describe("the sensor reads whichever path flag the dispatcher passes", () => {
  // The dispatcher picks the flag from a CLOSED literal in core
  // (`isCodeSensor = id === "linter" || id === "type-check"`), so a
  // plugin-contributed sensor can never be classified as a code sensor and
  // always receives --output-path. Reading only --file-path would make this
  // sensor no-op on every fire: exit 0, clean pass, file never opened.
  test("reads --file-path when the dispatcher treats it as a code sensor", () => {
    expect(targetPathFrom({ argv: ["--file-path", "src/a.ts"] })).toBe(
      "src/a.ts",
    );
  });

  test("reads --output-path, which is what a plugin sensor actually gets", () => {
    expect(targetPathFrom({ argv: ["--output-path", "src/b.ts"] })).toBe(
      "src/b.ts",
    );
  });

  test("prefers --file-path when both are present", () => {
    expect(
      targetPathFrom({
        argv: ["--output-path", "src/b.ts", "--file-path", "src/a.ts"],
      }),
    ).toBe("src/a.ts");
  });

  test("resolves to null when neither flag is passed", () => {
    expect(targetPathFrom({ argv: ["--stage", "rin-gate-4-implement"] })).toBe(
      null,
    );
  });

  test("resolves to null when a flag is passed with no value after it", () => {
    expect(targetPathFrom({ argv: ["--file-path"] })).toBe(null);
  });
});

describe("the formatter is the project's own installed Biome", () => {
  const repositoryRoot = `${import.meta.dirname}/../../..`;

  test("runs the resolved Biome CLI under the current runtime", () => {
    const command = biomeFormatCommand({
      filePath: "/repo/src/a.ts",
      projectRoot: "/repo",
      resolveTool: () => ({
        version: "2.4.16",
        cliPath: "/repo/node_modules/@biomejs/biome/bin/biome",
      }),
    });
    expect(command).toEqual({
      kind: "run",
      executable: process.execPath,
      commandArguments: [
        "/repo/node_modules/@biomejs/biome/bin/biome",
        "format",
        "--write",
        "--no-errors-on-unmatched",
        "/repo/src/a.ts",
      ],
    });
  });

  test("never falls back to a fetch-and-run launcher when Biome is absent", () => {
    const command = biomeFormatCommand({
      filePath: "/repo/src/a.ts",
      projectRoot: "/repo",
      resolveTool: () => null,
    });
    expect(command.kind).toBe("unavailable");
    expect(command.kind === "unavailable" && command.message).toContain(
      "@biomejs/biome",
    );
  });

  test("resolves Biome from the project's dependency tree", () => {
    expect(
      installedProjectTool({
        projectRoot: repositoryRoot,
        packageName: "@biomejs/biome",
        binName: "biome",
      }),
    ).not.toBeNull();
  });

  test("reports nothing for a package the project has not installed", () => {
    expect(
      installedProjectTool({
        projectRoot: repositoryRoot,
        packageName: "@biomejs/not-an-installed-package",
        binName: "biome",
      }),
    ).toBeNull();
  });
});

describe("only formatter-owned extensions are targeted", () => {
  test("a TypeScript file is formatted", () => {
    expect(FORMATTED_EXTENSIONS.test("src/a.ts")).toBe(true);
  });

  test("a JSON file is formatted", () => {
    expect(FORMATTED_EXTENSIONS.test("tsconfig.json")).toBe(true);
  });

  test("a markdown file is not — the formatter does not own prose", () => {
    expect(FORMATTED_EXTENSIONS.test("README.md")).toBe(false);
  });

  test("an extensionless path is not", () => {
    expect(FORMATTED_EXTENSIONS.test("Dockerfile")).toBe(false);
  });
});
