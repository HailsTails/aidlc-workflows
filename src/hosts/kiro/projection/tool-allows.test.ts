import { expect, test } from "bun:test";
import { source } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { expandKiroAgentAllows } from "./tool-allows.ts";

const file = { source: source("agents/aidlc.json"), content: { kind: "text" as const, text:
  '{"name":"aidlc","toolsSettings":{"execute_bash":{"allowedCommands":["bun (run )?[\\"\']?\\\\.kiro/tools/[A-Za-z0-9._-]+\\\\.ts[\\"\']?( .*)?","keep",7]}}}' } };
const allows = { dispatcherCommands: ["doctor"], toolScripts: ["aidlc-graph.ts"] };

test("the tools-folder pattern expands into bare and both quoted command forms", () => {
  expect(expandKiroAgentAllows({ file, allows })).toEqual(accepted({
    expansion: "expanded", file: { ...file, content: { kind: "text", text:
      '{\n  "name": "aidlc",\n  "toolsSettings": {\n    "execute_bash": {\n      "allowedCommands": [\n' +
      '        "bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\"\\\\.kiro/tools/aidlc\\\\.ts\\"|\'\\\\.kiro/tools/aidlc\\\\.ts\') engine( .*)?",\n' +
      '        "bun (run )?(\\\\.kiro/tools/aidlc\\\\.ts|\\"\\\\.kiro/tools/aidlc\\\\.ts\\"|\'\\\\.kiro/tools/aidlc\\\\.ts\') doctor",\n' +
      '        "bun (run )?(\\\\.kiro/tools/aidlc-graph\\\\.ts|\\"\\\\.kiro/tools/aidlc-graph\\\\.ts\\"|\'\\\\.kiro/tools/aidlc-graph\\\\.ts\')( .*)?",\n' +
      '        "keep",\n        7\n      ]\n    }\n  }\n}\n',
    } },
  }));
});

test("an unmatched allows array is still pretty-serialized without a per-file refusal", () => {
  expect(expandKiroAgentAllows({ ...{ allows }, file: { ...file, content: { kind: "text",
    text: '{"toolsSettings":{"execute_bash":{"allowedCommands":["keep"]}}}' } } }))
    .toEqual(accepted({ expansion: "unchanged", file: { ...file, content: { kind: "text",
      text: '{\n  "toolsSettings": {\n    "execute_bash": {\n      "allowedCommands": [\n        "keep"\n      ]\n    }\n  }\n}\n' } } }));
});

test("documents without an allows array retain their original bytes", () => {
  const original = { ...file, content: { kind: "text" as const, text: '{ "name": "other" }' } };
  expect(expandKiroAgentAllows({ file: original, allows })).toEqual(accepted({ expansion: "unchanged", file: original }));
});

test("malformed captured JSON is a named refusal", () => {
  expect(expandKiroAgentAllows({ file: { ...file, content: { kind: "text", text: "invalid" } }, allows }))
    .toEqual(refused({ kind: "render-failed", concept: "agent", name: file.source,
      reason: "The captured Kiro agent is not valid JSON." }));
});

test("prototype-named fields survive the allow-list rewrite at every object edge", () => {
  expect(expandKiroAgentAllows({ allows, file: { ...file, content: { kind: "text",
    text: '{"__proto__":"root","toolsSettings":{"__proto__":"settings","execute_bash":{"__proto__":"shell","allowedCommands":["keep"]}}}' },
  } })).toEqual(accepted({ expansion: "unchanged", file: { ...file, content: { kind: "text",
    text: '{\n  "__proto__": "root",\n  "toolsSettings": {\n    "__proto__": "settings",\n    "execute_bash": {\n      "__proto__": "shell",\n      "allowedCommands": [\n        "keep"\n      ]\n    }\n  }\n}\n',
  } } }));
});
