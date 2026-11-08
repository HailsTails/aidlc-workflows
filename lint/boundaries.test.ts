import { describe, expect, test } from "bun:test";
import { boundaryConfig } from "./boundaries.ts";
import { Linter } from "./eslint-port.ts";
import { standardsConfig } from "./standards.ts";

const BOUNDARIES: Linter.Config[] = [...standardsConfig, ...boundaryConfig];

describe("boundaryConfig in production code", () => {
  test("refuses a platform import in a domain module", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n',
      BOUNDARIES,
      { filename: "src/execution/domain/reader.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("keeps the kernel pure", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { z } from "zod";\nexport const name = z.string();\n',
      BOUNDARIES,
      { filename: "src/kernel/names.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("refuses one context reaching into another's adapters", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { stageFile } from "../../workflow-definition/adapters/stage-file.ts";\n' +
        "export const file = stageFile;\n",
      BOUNDARIES,
      { filename: "src/projection/adapters/reader.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });
});

const findingsFor = (code: string, filename: string): Linter.LintMessage[] =>
  new Linter({ configType: "flat" }).verify(code, BOUNDARIES, { filename });

const UNDECLARED = "not a layer of a context in lint/context-map.ts";

describe("boundaryConfig outside the declared layers", () => {
  test.each([
    "src/execution/services/runner.ts",
    "src/shared/ids.ts",
    "src/kernel/ids/stage-id.ts",
    "src/cli/domain/route.ts",
    "src/cli/application/route.ts",
  ])("refuses %s", (filename) => {
    expect(findingsFor("export const value = 1;\n", filename)).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining(UNDECLARED) }),
    );
  });

  test("leaves a declared layer to its own rules", () => {
    expect(findingsFor("export const value = 1;\n", "src/execution/domain/unit.ts")).toEqual([]);
  });
});

describe("boundaryConfig own-context layer arrows", () => {
  test.each([
    ["src/execution/domain/unit.ts", "../../execution/adapters/store.ts"],
    ["src/execution/domain/unit.ts", "../../execution/application/ports.ts"],
    ["src/execution/domain/unit.ts", "../main.ts"],
    ["src/execution/application/run.ts", "../../execution/main.ts"],
    ["src/execution/application/run.ts", "../../execution/adapters/store.ts"],
  ])("%s may not import %s", (filename, specifier) => {
    const code = `import { store } from "${specifier}";\nexport const used = store;\n`;

    expect(findingsFor(code, filename)).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" }),
    );
  });

  test("a pure layer may not import dynamically", () => {
    const code = 'export const load = () => import("node:fs");\n';

    expect(findingsFor(code, "src/execution/domain/unit.ts")).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-syntax" }),
    );
  });

  test("a pure layer may not reach effects through globalThis", () => {
    const code = 'export const file = globalThis.Bun.file("x");\n';

    expect(findingsFor(code, "src/execution/domain/unit.ts")).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-globals" }),
    );
  });
});

describe("boundaryConfig in colocated tests", () => {
  test("lets a domain test import bun:test and its own context's fixtures", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { expect, test } from "bun:test";\n' +
        'import { stage } from "../fixtures/identities.fixture.ts";\n' +
        'test("stage", () => expect(stage).toBeDefined());\n',
      BOUNDARIES,
      { filename: "src/workflow-definition/domain/stage.test.ts" },
    );

    expect(messages).toEqual([]);
  });

  test("still refuses an adapter import in a domain test", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { stageFile } from "../adapters/stage-file.ts";\nexport const file = stageFile;\n',
      BOUNDARIES,
      { filename: "src/workflow-definition/domain/stage.test.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("lets an adapter test import its own context's fixtures", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { expect, test } from "bun:test";\n' +
        'import { stage } from "../fixtures/identities.fixture.ts";\n' +
        'test("stage", () => expect(stage).toBeDefined());\n',
      BOUNDARIES,
      { filename: "src/workflow-definition/adapters/stage-file.test.ts" },
    );

    expect(messages).toEqual([]);
  });
});
