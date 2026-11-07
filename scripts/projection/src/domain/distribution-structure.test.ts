import { expect, mock, test } from "bun:test";
import { prepareDistributionStructure } from "./distribution-structure.ts";

test("derives sorted unique directory parents from paths alone with explicit 0755", () => {
  const rules = { path: mock().mockReturnValue("safe") };
  expect(prepareDistributionStructure({ files: [{ path: "z/sub/entry.ts" }, { path: "a/one.md" }, { path: "a/two.md" }], retained: [], mode: 0o755, rules })).toEqual({ status: "ok", value: [{ path: "a", mode: 0o755 }, { path: "z", mode: 0o755 }, { path: "z/sub", mode: 0o755 }] });
  expect(rules.path.mock.calls).toEqual([[{ path: "z/sub/entry.ts" }], [{ path: "a/one.md" }], [{ path: "a/two.md" }]]);
});

test("root files require no synthetic root or empty scaffolds", () => {
  expect(prepareDistributionStructure({ files: [{ path: "README.md" }], retained: [], mode: 0o700, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "ok", value: [] });
});

test("an empty file set requires no directories", () => {
  expect(prepareDistributionStructure({ files: [], retained: [], mode: 0o700, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "ok", value: [] });
});

test("a file-backed placeholder supplies its scaffold without a separate directory declaration", () => {
  expect(prepareDistributionStructure({ files: [{ path: "memory/templates/.gitkeep" }], retained: [{ path: "memory/templates", mode: 0o700 }], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "ok", value: [{ path: "memory", mode: 0o755 }, { path: "memory/templates", mode: 0o755 }] });
});

test.each([{ mode: -1 }, { mode: 0o1000 }, { mode: 1.5 }, { mode: NaN }, { mode: Infinity }])("invalid directory mode refuses rather than borrowing a child mode", ({ mode }) => {
  expect(prepareDistributionStructure({ files: [], retained: [], mode, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-structure", detail: "file-parent structure requires an explicit directory mode between 0 and 0777" }] });
});

test("explicit mode zero is preserved", () => {
  expect(prepareDistributionStructure({ files: [{ path: "entry/main.ts" }], retained: [], mode: 0, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "ok", value: [{ path: "entry", mode: 0 }] });
});

test("path admission refusal stops unsafe traversal before parent derivation", () => {
  const rules = { path: mock().mockReturnValue("unsafe") };
  expect(prepareDistributionStructure({ files: [{ path: "../outside.ts" }], retained: [], mode: 0o755, rules })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: "../outside.ts", detail: "file-parent structure requires safe relative file paths" }] });
  expect(rules.path.mock.calls).toEqual([[{ path: "../outside.ts" }]]);
});

test("unsafe retained directory names cannot bypass path admission", () => {
  expect(prepareDistributionStructure({ files: [], retained: [{ path: "../outside", mode: 0o755 }], mode: 0o755, rules: { path: mock().mockReturnValue("unsafe") } })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: "../outside", detail: "file-parent structure requires safe retained directory paths" }] });
});

test("empty retained scaffolds refuse instead of disappearing", () => {
  expect(prepareDistributionStructure({ files: [{ path: "entry/main.ts" }], retained: [{ path: "empty", mode: 0o755 }], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "empty", detail: "file-parent structure cannot retire an explicit directory without a final descendant file" }] });
});

test.each([{ second: "entry/main.ts" }, { second: "ENTRY/MAIN.TS" }] as const)("duplicate or case-aliased file destinations refuse", ({ second }) => {
  expect(prepareDistributionStructure({ files: [{ path: "entry/main.ts" }, { path: second }], retained: [], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: second, detail: "file-parent structure requires unique file paths without case aliases" }] });
});

test("mixed-case parent aliases refuse without rewriting authored paths", () => {
  expect(prepareDistributionStructure({ files: [{ path: "Entry/one.ts" }, { path: "entry/two.ts" }], retained: [], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "entry", detail: "file-parent directories cannot differ only by case" }] });
});

test("a file cannot also be the directory of another file", () => {
  expect(prepareDistributionStructure({ files: [{ path: "entry" }, { path: "entry/main.ts" }], retained: [], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "entry", detail: "a distribution file cannot also be a parent directory" }] });
});

test("case changes cannot bypass file-parent overlap admission", () => {
  expect(prepareDistributionStructure({ files: [{ path: "ENTRY" }, { path: "entry/main.ts" }], retained: [], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "entry", detail: "a distribution file cannot also be a parent directory" }] });
});

test("textual path prefixes without a slash do not cause false file-parent conflicts", () => {
  expect(prepareDistributionStructure({ files: [{ path: "entry" }, { path: "entry-more/main.ts" }], retained: [], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "ok", value: [{ path: "entry-more", mode: 0o755 }] });
});

test("retained directory case aliases cannot silently select a new spelling", () => {
  expect(prepareDistributionStructure({ files: [{ path: "entry/main.ts" }], retained: [{ path: "ENTRY", mode: 0o755 }], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "ENTRY", detail: "retained directory spelling must match final file parents" }] });
});

test("retained duplicates refuse even when both have a final descendant", () => {
  expect(prepareDistributionStructure({ files: [{ path: "entry/main.ts" }], retained: [{ path: "entry", mode: 0o755 }, { path: "entry", mode: 0o700 }], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "entry", detail: "file-parent structure requires unique retained directories without case aliases" }] });
});

test("retained directories cannot occupy a final file", () => {
  expect(prepareDistributionStructure({ files: [{ path: "entry" }], retained: [{ path: "entry", mode: 0o755 }], mode: 0o755, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "entry", detail: "retained directories cannot occupy or descend from a distribution file" }] });
});
