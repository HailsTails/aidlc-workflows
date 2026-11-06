import { expect, test } from "bun:test";
import { assertPluginCommands } from "./aidlc-plugin-validate.ts";

test("returns the admitted command entries including legitimate shared-script aliases", () => {
  expect(assertPluginCommands({ aidlc: { commands: {
    "example-run": { script: "tools/run.ts", description: "Run example" },
    "example-alias": { script: "tools/run.ts", description: "Run example alias" },
  } } })).toEqual({
    "example-alias": { script: "tools/run.ts", description: "Run example alias" },
    "example-run": { script: "tools/run.ts", description: "Run example" },
  });
});

test("retains command boundary refusal instead of returning partial admission", () => {
  expect(() => assertPluginCommands({ aidlc: { commands: {
    "example-run": { script: "../run.ts", description: "Run example" },
  } } })).toThrow('command "example-run" script must be one .ts file directly in tools/');
});
