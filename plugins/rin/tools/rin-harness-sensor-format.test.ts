import { afterEach, describe, expect, test } from "vitest";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import {
  biomeFormatCommand,
  FORMATTED_EXTENSIONS,
  formatRunFailure,
  installedProjectTool,
  targetPathFrom,
} from "./rin-harness-sensor-format.ts";
import { defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";

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

  test("runs the resolved Biome CLI as Bun under the running executable, from source or compiled", () => {
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
      environment: { BUN_BE_BUN: "1" },
    });
  });

  test("a Biome run that was killed or timed out is an execution failure, not a missing tool", () => {
    expect(formatRunFailure({ status: null })).toEqual({
      exitCode: 1,
      diagnostic: "biome-execution-incomplete",
    });
  });

  test("a Biome run that exited is not a failure of the sensor", () => {
    expect(formatRunFailure({ status: 0 })).toBeNull();
    expect(formatRunFailure({ status: 1 })).toBeNull();
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

describe("the format sensor's resolver matches the core resolver case for case", () => {
  const paths = defaultPathOperations();
  const files = defaultFileTextPort();
  const roots: string[] = [];

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      files.remove(root, { recursive: true, force: true });
    });
  });

  const temporaryProject = (): string => {
    const root = files.makeTemporaryDirectory(
      paths.join({ segments: [files.temporaryRoot(), "rin-format-resolver-"] }),
    );
    roots.push(root);
    files.write(paths.join({ segments: [root, "package.json"] }), "{}\n");
    return root;
  };

  const installPackage = ({
    directory,
    manifest,
    binFile,
  }: {
    readonly directory: string;
    readonly manifest: Readonly<Record<string, unknown>>;
    readonly binFile: string;
  }): string => {
    const packageDirectory = paths.join({
      segments: [directory, "node_modules", "@biomejs", "biome"],
    });
    files.mkdir(paths.join({ segments: [packageDirectory, "bin"] }), {
      recursive: true,
    });
    files.write(
      paths.join({ segments: [packageDirectory, "package.json"] }),
      JSON.stringify(manifest),
    );
    const cliPath = paths.join({ segments: [packageDirectory, binFile] });
    files.write(cliPath, "export {};\n");
    return cliPath;
  };

  const resolveBiome = (projectRoot: string) =>
    installedProjectTool({
      projectRoot,
      packageName: "@biomejs/biome",
      binName: "biome",
    });

  test("finds a single string bin installed beside the project", () => {
    const project = temporaryProject();
    const cliPath = installPackage({
      directory: project,
      manifest: { name: "@biomejs/biome", version: "2.4.16", bin: "bin/biome" },
      binFile: "bin/biome",
    });
    expect(resolveBiome(project)).toEqual({ version: "2.4.16", cliPath });
  });

  test("finds the named entry of a bin map", () => {
    const project = temporaryProject();
    const cliPath = installPackage({
      directory: project,
      manifest: {
        name: "@biomejs/biome",
        version: "2.4.16",
        bin: { biome: "./bin/biome", other: "./bin/other" },
      },
      binFile: "bin/biome",
    });
    expect(resolveBiome(project)?.cliPath).toBe(cliPath);
  });

  test("finds a hoisted install in an ancestor workspace", () => {
    const workspace = temporaryProject();
    const member = paths.join({ segments: [workspace, "packages", "member"] });
    files.mkdir(member, { recursive: true });
    const cliPath = installPackage({
      directory: workspace,
      manifest: { name: "@biomejs/biome", version: "2.4.16", bin: "bin/biome" },
      binFile: "bin/biome",
    });
    expect(resolveBiome(member)?.cliPath).toBe(cliPath);
  });

  test("the nearest install decides, as Node resolution does", () => {
    const workspace = temporaryProject();
    installPackage({
      directory: workspace,
      manifest: { name: "@biomejs/biome", version: "2.4.16", bin: "bin/biome" },
      binFile: "bin/biome",
    });
    const member = paths.join({ segments: [workspace, "member"] });
    const nearest = paths.join({
      segments: [member, "node_modules", "@biomejs", "biome"],
    });
    files.mkdir(nearest, { recursive: true });
    files.write(
      paths.join({ segments: [nearest, "package.json"] }),
      JSON.stringify({ name: "@biomejs/biome", version: "2.0.0" }),
    );
    expect(resolveBiome(member)).toBeNull();
  });

  test("a package directory holding a different package is not adopted", () => {
    const project = temporaryProject();
    installPackage({
      directory: project,
      manifest: { name: "not-biome", version: "2.4.16", bin: "bin/biome" },
      binFile: "bin/biome",
    });
    expect(resolveBiome(project)).toBeNull();
  });

  test("an empty bin path is not adopted", () => {
    const project = temporaryProject();
    installPackage({
      directory: project,
      manifest: { name: "@biomejs/biome", version: "2.4.16", bin: "" },
      binFile: "bin/biome",
    });
    expect(resolveBiome(project)).toBeNull();
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
