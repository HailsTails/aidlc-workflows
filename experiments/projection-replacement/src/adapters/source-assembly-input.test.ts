import { expect, test } from "bun:test";
import { parseSourceAssemblyArguments } from "./source-assembly-input.ts";
test("accepts explicit source and prepared runtime locations", () => {
  expect(parseSourceAssemblyArguments({ argv: ["source", "runtime", "d062c81e5678c9f92162542b425b8a5f095e46e1", "all"] })).toEqual({ status: "ok", value: { sourceRoot: "source", runtimeRoot: "runtime", pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", sharedKnowledge: "all", showFile: null } });
});
test("accepts one selected native file", () => {
  expect(parseSourceAssemblyArguments({ argv: ["source", "runtime", "d062c81e5678c9f92162542b425b8a5f095e46e1", "methodology-only", ".claude/agents/quality.md"] })).toEqual({ status: "ok", value: { sourceRoot: "source", runtimeRoot: "runtime", pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", sharedKnowledge: "methodology-only", showFile: ".claude/agents/quality.md" } });
});
test.each([[], ["source", "runtime", "short", "all"], ["", "runtime", "d062c81e5678c9f92162542b425b8a5f095e46e1", "all"], ["source", "runtime", "d062c81e5678c9f92162542b425b8a5f095e46e1", "unknown"], ["source", "runtime", "d062c81e5678c9f92162542b425b8a5f095e46e1"], ["source", "runtime", "d062c81e5678c9f92162542b425b8a5f095e46e1", "all", "file", "extra"]])("refuses invalid invocation %#", (...argv) => {
  expect(parseSourceAssemblyArguments({ argv })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-preview", detail: "usage: preview:source <trusted-source-root> <prepared-Claude-root> <source-pin> <all|methodology-only> [selected-native-file]" }] });
});
