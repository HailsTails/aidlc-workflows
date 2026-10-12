import { expect, test } from "bun:test";
import { emitDefaultRules } from "./emit.ts";

test("copy rules enumerate exact relative file arguments in sorted unique order", () => {
  const rules = emitDefaultRules(".codex", "bun", "engine", ["aidlc.ts", "aidlc-state.ts", "aidlc.ts"]);
  expect(rules).toContain('prefix_rule(pattern = ["bun", [".codex/tools/aidlc-state.ts","./.codex/tools/aidlc-state.ts",".codex\\\\tools\\\\aidlc-state.ts",".\\\\.codex\\\\tools\\\\aidlc-state.ts",".codex/tools/aidlc.ts","./.codex/tools/aidlc.ts",".codex\\\\tools\\\\aidlc.ts",".\\\\.codex\\\\tools\\\\aidlc.ts"]], decision = "allow")');
  expect(rules).not.toContain('pattern = ["bun", ".codex/tools/"]');
  expect(rules).not.toContain('pattern = ["bun"]');
});

test("copy rules exclude tests, unrelated filenames and nonlocal filename inputs", () => {
  const rules = emitDefaultRules(".codex", "bun", "engine", ["aidlc.ts", "aidlc.test.ts", "other.ts", "aidlc.ts.evil", "../aidlc-evil.ts", "nested/aidlc-evil.ts", "nested\\aidlc-evil.ts"]);
  expect(rules).toContain('prefix_rule(pattern = ["bun", [".codex/tools/aidlc.ts","./.codex/tools/aidlc.ts",".codex\\\\tools\\\\aidlc.ts",".\\\\.codex\\\\tools\\\\aidlc.ts"]], decision = "allow")');
  expect(rules).not.toContain("aidlc-evil");
  expect(rules).not.toContain("aidlc.test.ts");
  expect(rules).not.toContain("other.ts");
  expect(rules).not.toContain("aidlc.ts.evil");
});

test("copy rules project the configured harness directory", () => {
  const rules = emitDefaultRules(".custom", "bun", "engine", ["aidlc.ts"]);
  expect(rules).toContain('".custom/tools/aidlc.ts"');
  expect(rules).not.toContain(".codex/");
});

test("native rules preserve the trusted namespace without a Bun allowlist", () => {
  const rules = emitDefaultRules(".codex", "aidlc", "engine", ["aidlc.ts"]);
  expect(rules).toContain('prefix_rule(pattern = ["aidlc", "engine"], decision = "allow")');
  expect(rules).not.toContain('pattern = ["bun"');
  expect(rules).toContain('prefix_rule(pattern = ["git", "add"], decision = "allow")');
});

test("rule emission leaves the supplied tool inventory unchanged", () => {
  const names = ["aidlc.ts", "aidlc-state.ts"];
  emitDefaultRules(".codex", "bun", "engine", names);
  expect(names).toEqual(["aidlc.ts", "aidlc-state.ts"]);
});
