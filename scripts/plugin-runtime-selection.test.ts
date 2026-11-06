import { expect, test } from "bun:test";
import { selectPluginRuntimeProducts } from "./plugin-runtime-selection.ts";

test.each([
  { harness: "claude", files: ["hooks/guard.ts", "tools/command.ts", "tools/reader.ts"], commandScripts: ["tools/command.ts"], expected: { kind: "selected", files: ["hooks/guard.ts", "tools/command.ts", "tools/reader.ts"], closedModules: ["tools/command.ts"] } },
  { harness: "codex", files: ["hooks/guard.ts", "tools/command.ts", "tools/reader.ts"], commandScripts: ["tools/command.ts"], expected: { kind: "selected", files: ["tools/command.ts"], closedModules: ["tools/command.ts"] } },
  { harness: "kiro", files: ["tools/command.ts"], commandScripts: ["tools/command.ts", "tools/command.ts"], expected: { kind: "selected", files: ["tools/command.ts"], closedModules: ["tools/command.ts"] } },
  { harness: "cursor", files: ["hooks/guard.ts"], commandScripts: [], expected: { kind: "not-needed" } },
  { harness: "claude", files: ["hooks/guard.ts"], commandScripts: [], expected: { kind: "selected", files: ["hooks/guard.ts"], closedModules: [] } },
  { harness: "claude", files: [], commandScripts: [], expected: { kind: "not-needed" } },
  { harness: "claude", files: ["hooks/command.ts"], commandScripts: ["tools/command.ts"], expected: { kind: "refused", message: "declared plugin command was not projected: tools/command.ts" } },
  { harness: "codex", files: ["other/tools/command.ts"], commandScripts: ["tools/command.ts"], expected: { kind: "refused", message: "declared plugin command was not projected: tools/command.ts" } },
  { harness: "claude", files: ["tools/command.ts", "tools/command.ts"], commandScripts: ["tools/command.ts"], expected: { kind: "refused", message: "declared plugin command has ambiguous projected ownership: tools/command.ts" } },
])("selects runtime products from explicit commands: $harness $files", ({ harness, files, commandScripts, expected }) => {
  expect(selectPluginRuntimeProducts({ harness, files, commandScripts })).toEqual(expected);
});

test("does not mutate authored inventories", () => {
  const files = Object.freeze(["tools/command.ts"]);
  const commandScripts = Object.freeze(["tools/command.ts", "tools/command.ts"]);
  selectPluginRuntimeProducts({ harness: "codex", files, commandScripts });
  expect(files).toEqual(["tools/command.ts"]);
  expect(commandScripts).toEqual(["tools/command.ts", "tools/command.ts"]);
});
