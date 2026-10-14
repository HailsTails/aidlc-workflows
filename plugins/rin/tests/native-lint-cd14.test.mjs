import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { expect, test } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import { biomeCd14, eslintCd14 } from "../tools/native-lint/cd14/config.mjs";

const lint = async (source, filePath = "src/probe.ts") => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tsParser },
        rules: { "no-restricted-syntax": ["error", "DebuggerStatement"] },
      },
      ...eslintCd14({ projectDir: process.cwd(), files: ["**/*.ts"] }),
    ],
  });
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.map(({ ruleId }) => ruleId);
};

test("CD-14 rejects authored classes while retaining a host restriction", async () => {
  expect(await lint("class Runtime {}\nconst Alias = class {};\nexport default class {}\ndebugger;"))
    .toEqual([
      "rin-discipline/no-class-authoring",
      "rin-discipline/no-class-authoring",
      "rin-discipline/no-class-authoring",
      "no-restricted-syntax",
    ]);
});

test("ambient namespaces and declarations stay distinct from runtime classes", async () => {
  expect(await lint(`
    declare class Declared {}
    declare namespace Ambient { class Nested {} }
    declare module "remote" { export class Remote {} }
    namespace Runtime { export class Nested {} }
  `)).toEqual(["rin-discipline/no-class-authoring"]);
  expect(await lint("declare class FromDependency {}", "src/types.d.ts")).toEqual([]);
});


test("Biome carve excludes the exact file but retains a nested suffix match", () => {
  const temporary = mkdtempSync(join(tmpdir(), "cd14-exact-carve-"));
  try {
    mkdirSync(join(temporary, "src"));
    writeFileSync(join(temporary, "src", "foo.ts"), "class Carved {}");
    mkdirSync(join(temporary, ".constitution-carve-outs"));
    writeFileSync(join(temporary, ".constitution-carve-outs", "cd-14.json"), JSON.stringify([
      { files: ["src/foo.ts"], reason: "Fixture debt", decision: "Fixture only" },
    ]));
    const config = biomeCd14({
      projectDir: temporary, hostPath: "biome.host.json", host: {},
      pluginPath: "./no-class-authoring.grit", includes: ["**/*.ts"],
    });
    const exclusion = config.plugins[0].includes.at(-1);
    const matcher = new Bun.Glob(exclusion.slice(1));
    expect(matcher.match(join(temporary, "src", "foo.ts").split(sep).join("/"))).toBe(true);
    expect(matcher.match(join(temporary, "test", "fixture", "src", "foo.ts").split(sep).join("/"))).toBe(false);

    const globRoot = join(temporary, "[project]");
    mkdirSync(join(globRoot, "src"), { recursive: true });
    writeFileSync(join(globRoot, "src", "foo.ts"), "class Carved {}");
    mkdirSync(join(globRoot, ".constitution-carve-outs"));
    writeFileSync(join(globRoot, ".constitution-carve-outs", "cd-14.json"), JSON.stringify([
      { files: ["src/foo.ts"], reason: "Fixture debt", decision: "Fixture only" },
    ]));
    expect(() => biomeCd14({
      projectDir: globRoot, hostPath: "biome.host.json", host: {},
      pluginPath: "./no-class-authoring.grit", includes: ["**/*.ts"],
    })).toThrow("without glob characters");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Biome keeps selected host extends at the composed root", () => {
  const host = { extends: ["./cd42.biome.json", "./cd44.biome.json"] };
  const config = biomeCd14({
    projectDir: process.cwd(), hostPath: "./biome.host.json", host,
    pluginPath: "./no-class-authoring.grit", includes: ["**/*.ts"],
  });
  expect(config.extends).toEqual(["./cd42.biome.json", "./cd44.biome.json", "./biome.host.json"]);
  expect(host.extends).toEqual(["./cd42.biome.json", "./cd44.biome.json"]);
  expect(() => biomeCd14({
    projectDir: process.cwd(), hostPath: "./biome.host.json", host: { extends: "//" },
    pluginPath: "./no-class-authoring.grit", includes: ["**/*.ts"],
  })).toThrow("array of explicit config paths");
});
