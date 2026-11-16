import { describe, expect, it } from "vitest";
import { createPathPort } from "../platform-ports/path-port.ts";
import {
  installRootAboveEntry,
  moduleExtensionOf,
  moduleFileForm,
  runnerModuleSegmentsOf,
} from "./install-layout.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const directoryOf = (path: string): string => posixPath.directoryOf({ path });

describe("installRootAboveEntry", () => {
  it("is the folder holding core/ for a command entry under core/check/", () => {
    expect(installRootAboveEntry({ entryFile: "/install/core/check/check-command.js", entry: "command", directoryOf })).toBe(
      "/install",
    );
  });

  it("is the folder holding mechanisms/ for a runner entry under mechanisms/<mechanism>/runner/", () => {
    expect(
      installRootAboveEntry({ entryFile: "/install/mechanisms/eslint/runner/runner.ts", entry: "runner", directoryOf }),
    ).toBe("/install");
  });
});

describe("moduleExtensionOf", () => {
  it("is .js for a module of a built install", () => {
    expect(moduleExtensionOf({ moduleUrl: "file:///project/node_modules/core/chunks/shared-ab12.js" })).toBe(".js");
  });

  it("is .ts for a module run from source", () => {
    expect(moduleExtensionOf({ moduleUrl: "file:///repo/tools/discipline-core/core/values/install-layout.ts" })).toBe(".ts");
  });
});

describe("runnerModuleSegmentsOf", () => {
  it("names the built runner module in a built install", () => {
    expect(runnerModuleSegmentsOf({ installRoot: "/install", mechanism: "eslint", moduleExtension: ".js" })).toEqual([
      "/install",
      "mechanisms",
      "eslint",
      "runner",
      "runner.js",
    ]);
  });

  it("names the source runner module in a source install", () => {
    expect(runnerModuleSegmentsOf({ installRoot: "/install", mechanism: "audit", moduleExtension: ".ts" })).toEqual([
      "/install",
      "mechanisms",
      "audit",
      "runner",
      "runner.ts",
    ]);
  });
});

describe("moduleFileForm", () => {
  it.each(["piece.ts", "cd1/cd1.eslint-plugin.js"])("is a module file for %j", (text) => {
    expect(moduleFileForm({ text })).toBe("module-file");
  });

  it.each(["piece.mjs", "piece.cjs", "piece", "piece.json"])("is not a module file for %j", (text) => {
    expect(moduleFileForm({ text })).toBe("not-module-file");
  });
});
