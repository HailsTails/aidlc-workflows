// covers: function:machineReachingToolScripts, function:preapprovedCopyToolScripts, function:preapprovedDispatcherCommands

import { expect, test } from "bun:test";
import { machineReachingToolScripts, preapprovedCopyToolScripts, preapprovedDispatcherCommands } from "./aidlc-copy-preapproval.ts";

test("any machine route excludes its shared script, sorted and once", () => {
  expect(machineReachingToolScripts({ routes: [
    { mutationScope: "project", tool: "shared.ts" },
    { mutationScope: "machine", tool: "z.ts" },
    { mutationScope: "project-and-machine", tool: "shared.ts" },
    { mutationScope: "machine", tool: "z.ts" },
    { mutationScope: "machine" },
  ] })).toEqual(["shared.ts", "z.ts"]);
});

test.each(["none", "project", "user-home", "future-scope"])("%s does not acquire machine authority by inference", (mutationScope) => {
  expect(machineReachingToolScripts({ routes: [{ mutationScope, tool: "tool.ts" }] })).toEqual([]);
});

test("copy scripts exclude machine tools and retain unclassified tools", () => {
  expect(preapprovedCopyToolScripts({
    machineToolScripts: ["machine.ts", "shared.ts"],
    toolScripts: ["z.ts", "machine.ts", "a.ts", "shared.ts", "z.ts", "unclassified.ts"],
  })).toEqual(["a.ts", "unclassified.ts", "z.ts"]);
});

test("empty catalogs do not invent tools", () => {
  expect(preapprovedCopyToolScripts({ machineToolScripts: [], toolScripts: [] })).toEqual([]);
  expect(machineReachingToolScripts({ routes: [] })).toEqual([]);
});

test("only explicit utility spellings are approved without configuration facts", () => {
  expect(preapprovedDispatcherCommands({ configSections: [], recordableProjectBypasses: [] })).toEqual([
    "doctor", "doctor --verbose", "version", "--doctor", "--doctor --verbose", "--version",
    "status", "--status", "config --help", "config --show", "config --show --json",
  ]);
});

test("declared sections and check restorations retain ordering and duplicates", () => {
  expect(preapprovedDispatcherCommands({ configSections: ["z", "a", "z"], recordableProjectBypasses: ["second", "first", "second"] })).toEqual([
    "doctor", "doctor --verbose", "version", "--doctor", "--doctor --verbose", "--version",
    "status", "--status", "config --help", "config --show", "config --show --json",
    "config z --show", "config z --show --json", "config z --help",
    "config a --show", "config a --show --json", "config a --help",
    "config z --show", "config z --show --json", "config z --help",
    "config flags --clear-bypass second --yes", "config flags --clear-bypass first --yes", "config flags --clear-bypass second --yes",
  ]);
});

test("policy accepts frozen input facts and returns independent results", () => {
  const toolScripts = Object.freeze(["z.ts", "a.ts", "z.ts"]);
  const machineToolScripts = Object.freeze(["z.ts"]);
  expect(preapprovedCopyToolScripts({ machineToolScripts, toolScripts })).toEqual(["a.ts"]);
  expect(toolScripts).toEqual(["z.ts", "a.ts", "z.ts"]);
  expect(machineToolScripts).toEqual(["z.ts"]);
});
