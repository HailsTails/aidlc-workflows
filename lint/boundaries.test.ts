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
