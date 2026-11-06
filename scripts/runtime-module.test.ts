import { expect, test } from "bun:test";
import { prepareRuntimeModuleText, substituteRuntimeInvocation } from "./runtime-module.ts";

test.each([
  { invoke: "bun .claude/tools/aidlc.ts", expected: "bun .claude/tools/aidlc.ts|bun .claude/tools/|engine|{{HARNESS_DIR}}|{{INVOKE_SUFFIX}}" },
  { invoke: "aidlc", expected: "aidlc|aidlc engine |engine|{{HARNESS_DIR}}|{{INVOKE_SUFFIX}}" },
])("substitutes only the native invocation vocabulary for $invoke", ({ invoke, expected }) => {
  expect(substituteRuntimeInvocation({ source: "{{INVOKE}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}|{{HARNESS_DIR}}|{{INVOKE_SUFFIX}}", harnessDir: ".claude", invoke })).toBe(expected);
});

test("unchanged build version preserves authored version bytes without requiring a declaration", () => {
  expect(prepareRuntimeModuleText({ file: "aidlc-version.ts", source: "opaque\r\n", harnessDir: ".claude", invoke: "bun .claude/tools/aidlc.ts", sourceVersion: "1.0.0", buildVersion: "1.0.0" })).toEqual({ kind: "prepared", content: "opaque\r\n" });
});

test.each([
  { file: "aidlc-version.ts", source: 'export const AIDLC_VERSION = "1.0.0";\n', expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "1.0.1-preview.1";\n' } },
  { file: "aidlc-version.ts", source: 'export const AIDLC_VERSION = "1.0.0";\r\n{{TOOL_PREFIX}}', expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "1.0.1-preview.1";\r\nbun .claude/tools/' } },
  { file: "tools\\aidlc-version.ts", source: 'export const AIDLC_VERSION = "1.0.0";\n', expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "1.0.0";\n' } },
  { file: "aidlc-version.ts", source: "no assignment\n", expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 0" } },
  { file: "aidlc-version.ts", source: 'export const AIDLC_VERSION = "1.0.0";\nexport const AIDLC_VERSION = "1.0.0";\n', expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 2" } },
  { file: "tools/not-aidlc-version.ts", source: 'export const AIDLC_VERSION = "1.0.0";\n{{INVOKE}}', expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "1.0.0";\nbun .claude/tools/aidlc.ts' } },
  { file: "tools/aidlc-version.ts/helper.ts", source: "no assignment\n", expected: { kind: "prepared", content: "no assignment\n" } },
])("prepares version text using exact module identity: $file", ({ file, source, expected }) => {
  expect(prepareRuntimeModuleText({ file, source, harnessDir: ".claude", invoke: "bun .claude/tools/aidlc.ts", sourceVersion: "1.0.0", buildVersion: "1.0.1-preview.1" })).toEqual(expected);
});
