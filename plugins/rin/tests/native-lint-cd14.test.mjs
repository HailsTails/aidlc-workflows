import { expect, test } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import { eslintCd14 } from "../tools/native-lint/cd14/config.mjs";

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
