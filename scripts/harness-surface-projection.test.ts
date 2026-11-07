// covers: function:authoredHarnessSurface, function:kiroSharedKnowledgeRequirement, function:expandKiroSharedKnowledge

import { expect, test } from "bun:test";
import { authoredHarnessSurface, expandKiroSharedKnowledge, kiroSharedKnowledgeRequirement } from "./harness-surface-projection.ts";

test.each(["claude", "codex", "cursor", "copilot", "opencode", "future-host"])("%s keeps authored files on the ordinary transform path", (flavor) => {
  expect(authoredHarnessSurface({ flavor, source: "agents/product-agent.json" })).toBe("standard");
  expect(authoredHarnessSurface({ flavor, source: "settings/cli.json" })).toBe("standard");
});

test.each(["agents/product-agent.json", "agents/aidlc.json", "agents/nested/support.json"])("the declared Kiro flavor projects native agent JSON: %s", (source) => {
  expect(authoredHarnessSurface({ flavor: "kiro", source })).toBe("kiro-agent-json");
});

test("only the exact Kiro CLI settings surface receives model defaults", () => {
  expect(authoredHarnessSurface({ flavor: "kiro", source: "settings/cli.json" })).toBe("kiro-cli-settings");
});

test.each(["agents/product-agent.JSON", "agents/product-agent.md", "nested/agents/product-agent.json", "./agents/product-agent.json", "agents\\product-agent.json", "settings/cli.json.example", "other/cli.json"])("other Kiro sources retain the ordinary path: %s", (source) => {
  expect(authoredHarnessSurface({ flavor: "kiro", source })).toBe("standard");
});

test("shared knowledge filenames are required only for the exact authored resource glob", () => {
  expect(kiroSharedKnowledgeRequirement({ resources: ["file://other.md", "file://.kiro/knowledge/aidlc-shared/*.md"] })).toBe("shared-methodology");
});

test.each([
  { resources: [] },
  { resources: ["file://.kiro/knowledge/aidlc-shared/explicit.md"] },
  { resources: ["file://.kiro/knowledge/aidlc-shared/*"] },
  { resources: ["file://.kiro/knowledge/aidlc-shared/*.MD"] },
  { resources: [null, 7, false, { resource: "file://.kiro/knowledge/aidlc-shared/*.md" }] },
])("resource facts without the exact glob require no directory read: $resources", ({ resources }) => {
  expect(kiroSharedKnowledgeRequirement({ resources })).toBe("unchanged");
});

test("dispatch knowledge expands sorted Markdown files and excludes the existing format-document set", () => {
  expect(expandKiroSharedKnowledge({
    resources: ["file://before.md", "file://.kiro/knowledge/aidlc-shared/*.md", "file://after.md"],
    availableFiles: ["z-method.md", "format.md", "a-method.md", "notes.txt", "UPPER.MD"],
    formatDocuments: new Set(["format.md"]),
  })).toEqual([
    "file://before.md", "file://.kiro/knowledge/aidlc-shared/a-method.md",
    "file://.kiro/knowledge/aidlc-shared/z-method.md", "file://after.md",
  ]);
});

test("multiple glob entries preserve repeated preload groups and explicit resources", () => {
  expect(expandKiroSharedKnowledge({
    resources: ["file://.kiro/knowledge/aidlc-shared/*.md", "file://.kiro/knowledge/aidlc-shared/a.md", "file://.kiro/knowledge/aidlc-shared/*.md"],
    availableFiles: ["a.md"], formatDocuments: new Set(),
  })).toEqual([
    "file://.kiro/knowledge/aidlc-shared/a.md", "file://.kiro/knowledge/aidlc-shared/a.md", "file://.kiro/knowledge/aidlc-shared/a.md",
  ]);
});

test("an empty eligible knowledge set removes the glob without dropping unrelated JSON values", () => {
  expect(expandKiroSharedKnowledge({
    resources: [null, false, 7, ["nested"], { named: "resource" }, "file://.kiro/knowledge/aidlc-shared/*.md"],
    availableFiles: ["format.md", "notes.txt"], formatDocuments: new Set(["format.md"]),
  })).toEqual([null, false, 7, ["nested"], { named: "resource" }]);
});

test("inputs without a glob retain their resource values", () => {
  expect(expandKiroSharedKnowledge({ resources: ["file://explicit.md", null], availableFiles: ["method.md"], formatDocuments: new Set() }))
    .toEqual(["file://explicit.md", null]);
});

test("expansion does not reorder the supplied filename snapshot", () => {
  const availableFiles = ["z.md", "a.md"];
  expect(expandKiroSharedKnowledge({ resources: ["file://.kiro/knowledge/aidlc-shared/*.md"], availableFiles, formatDocuments: new Set() }))
    .toEqual(["file://.kiro/knowledge/aidlc-shared/a.md", "file://.kiro/knowledge/aidlc-shared/z.md"]);
  expect(availableFiles).toEqual(["z.md", "a.md"]);
});
