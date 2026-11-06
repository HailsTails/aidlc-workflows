import { expect, test } from "bun:test";
import { formatProjectionSet } from "./projection-set-view.ts";
import { assemblySet, configuredAssembly } from "../../__tests__/projection-set-fixtures.ts";
test("inventory identifies selected scope and files", () => {
  expect(formatProjectionSet({ projection: assemblySet, showFile: null })).toEqual({ status: "ok", value: "Selected-surface projection: claude\n1 units; 1 files\n.claude/agents/test-pro-metrics-agent.md\nScope: selected files only; installation and runtime activation are not planned.\n" });
});
test("selected native file preserves exact body", () => {
  expect(formatProjectionSet({ projection: assemblySet, showFile: ".claude/agents/test-pro-metrics-agent.md" })).toEqual({ status: "ok", value: "Native persona\n" });
});
test("unknown file returns specific guidance", () => {
  expect(formatProjectionSet({ projection: assemblySet, showFile: "../secret" })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: "../secret", detail: "requested file is not in the selected projection set; inspect the inventory first" }] });
});
test("configured discovery remains visible once", () => {
  expect(formatProjectionSet({ projection: configuredAssembly, showFile: null })).toEqual({ status: "ok", value: "Selected-surface projection: opencode\n2 units; 1 files\n.claude/agents/test-pro-metrics-agent.md\nDiscovery: opencode.json must include .aidlc/skills\nScope: selected files only; installation and runtime activation are not planned.\n" });
});
