import { describe, expect, test } from "bun:test";
import { Linter } from "./eslint-port.ts";
import { standardsConfig } from "./standards.ts";

describe("standardsConfig", () => {
  test("parses TypeScript and applies the Biome successor rules", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      "export const same = (left: number): number => (left == 1 ? 1 : 0);\n",
      standardsConfig,
      { filename: "core/tools/sample.ts" },
    );

    expect(messages).toEqual([expect.objectContaining({ ruleId: "eqeqeq", line: 1 })]);
  });
});
