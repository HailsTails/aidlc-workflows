import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command, CommandRunner } from "../application/ports.ts";
import { HONE_ENTRY, honePackage } from "./hone-package.ts";

const installedRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "hone-package-"));
  mkdirSync(join(root, "node_modules/@hailstails/hone/src"), { recursive: true });
  writeFileSync(join(root, HONE_ENTRY), "");
  return root;
};

const runnerPrinting = (output: string, exitCode = 0): CommandRunner & { commands: Command[] } => {
  const commands: Command[] = [];
  return {
    commands,
    capture: (command) => {
      commands.push(command);
      return { exitCode, output };
    },
    captureAll: async () => [],
    attach: () => 0,
  };
};

describe("honePackage toolchain", () => {
  test("is ready when the package is installed", () => {
    const root = installedRoot();

    const ready = honePackage({ root, runner: runnerPrinting("") }).ready();

    rmSync(root, { recursive: true, force: true });
    expect(ready).toEqual({ ok: true, value: join(root, HONE_ENTRY) });
  });

  test("names bun install when the package is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "hone-package-"));

    const ready = honePackage({ root, runner: runnerPrinting("") }).ready();

    rmSync(root, { recursive: true, force: true });
    expect(ready).toMatchObject({ ok: false, fix: expect.stringContaining("bun install") });
  });
});

describe("honePackage check", () => {
  test("passes the base revision to the package's own check", () => {
    const root = installedRoot();
    const runner = runnerPrinting("verdict: pass\n");

    honePackage({ root, runner }).run("origin/main");

    rmSync(root, { recursive: true, force: true });
    expect(runner.commands[0]?.argv).toEqual([
      "node",
      HONE_ENTRY,
      "check",
      "--base-revision",
      "origin/main",
      "--repo",
      ".",
    ]);
  });

});

describe("honePackage report", () => {
  test("reads findings and unanswered sections from the report", () => {
    const root = installedRoot();
    const output = [
      "answered (2)",
      "a#b walker x.ts:1:1 fine",
      "findings (1)",
      "drawer-path#drawer-names walker packaging/build-distributions.ts:1:0 forbidden folder",
      "unrecorded (1)",
      "long-function#function-length eslint ignore hone.eslint.d.mts",
      "verdict: fail",
    ].join("\n");

    const report = honePackage({ root, runner: runnerPrinting(output) }).run("origin/main");

    rmSync(root, { recursive: true, force: true });
    expect(report).toEqual({
      kind: "ran",
      verdict: "fail",
      findings: [
        {
          clause: "drawer-path#drawer-names",
          location: "packaging/build-distributions.ts:1:0",
          snippet: "forbidden categorical folder",
        },
      ],
      problems: ["unrecorded: long-function#function-length eslint ignore hone.eslint.d.mts"],
    });
  });

  test("reports a load failure when no verdict is printed", () => {
    const root = installedRoot();

    const report = honePackage({
      root,
      runner: runnerPrinting("load failure: runner-failed eslint x", 2),
    }).run("origin/main");

    rmSync(root, { recursive: true, force: true });
    expect(report).toMatchObject({
      kind: "failed",
      problem: "load failure: runner-failed eslint x",
    });
  });
});
