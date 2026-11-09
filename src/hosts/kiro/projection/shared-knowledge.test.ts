import { expect, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import type { KnowledgeDocument } from "../../../workflow-definition/domain/knowledge.ts";
import type { PluginId } from "../../../workflow-definition/domain/identities.ts";
import { sharedKnowledgeResources } from "./shared-knowledge.ts";

const document = (source: string): KnowledgeDocument => ({
  source: brand<MethodSourcePath>(source), owner: { kind: "core" }, audience: { kind: "shared" },
});

test("shared resources select sorted direct core markdown and exclude format documents", () => {
  expect(sharedKnowledgeResources({ documents: [
    document("knowledge/aidlc-shared/z.md"), document("knowledge/aidlc-shared/a.md"),
    document("knowledge/aidlc-shared/nested/ignored.md"), document("knowledge/aidlc-shared/no.txt"),
    document("knowledge/aidlc-shared/format.md"),
    { ...document("knowledge/aidlc-shared/plugin.md"),
      owner: { kind: "plugin", plugin: brand<PluginId>("example") } },
  ], formatDocuments: new Set(["format.md"]) })).toEqual([
    "file://.kiro/knowledge/aidlc-shared/a.md", "file://.kiro/knowledge/aidlc-shared/z.md",
  ]);
});

test("empty shared knowledge stays empty", () => {
  expect(sharedKnowledgeResources({ documents: [], formatDocuments: new Set() })).toEqual([]);
});
