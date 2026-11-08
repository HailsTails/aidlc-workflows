import { describe, expect, test } from "bun:test";
import { boundaryConfig } from "./boundaries.ts";
import { Linter } from "./eslint-port.ts";
import { standardsConfig } from "./standards.ts";

const BOUNDARIES: Linter.Config[] = [...standardsConfig, ...boundaryConfig];

describe("boundaryConfig", () => {
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
