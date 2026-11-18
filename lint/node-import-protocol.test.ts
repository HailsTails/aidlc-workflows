import { describe, expect, test } from "bun:test";
import { Linter } from "./eslint-port.ts";
import { nodeImportProtocol } from "./node-import-protocol.ts";

const PROTOCOL: Linter.Config[] = [
  {
    plugins: { aidlc: { rules: { "node-import-protocol": nodeImportProtocol } } },
    rules: { "aidlc/node-import-protocol": "error" },
  },
];

describe("node-import-protocol", () => {
  test("reports a bare built-in import", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { readFileSync } from "fs";\n',
      PROTOCOL,
    );

    expect(messages).toEqual([
      expect.objectContaining({
        ruleId: "aidlc/node-import-protocol",
        message: "Import Node built-ins through node:fs so a package can never shadow them.",
      }),
    ]);
  });

  test("allows the node: protocol and packages", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { readFileSync } from "node:fs";\nimport { z } from "zod";\n',
      PROTOCOL,
    );

    expect(messages).toEqual([]);
  });
});
