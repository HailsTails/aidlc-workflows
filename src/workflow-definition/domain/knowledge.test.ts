import { expect, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import type { MethodSourcePath } from "./method-source.ts";
import type { KnowledgeDocument } from "./knowledge.ts";
import type { PluginId } from "./identities.ts";
import { sharedKnowledgeSources } from "./knowledge.ts";

const document = (source: string): KnowledgeDocument => ({
  source: brand<MethodSourcePath>(source), owner: { kind: "core" }, audience: { kind: "shared" },
});

test("shared resources select sorted direct core markdown and exclude format documents", () => {
  expect(sharedKnowledgeSources({ documents: [
    document("knowledge/aidlc-shared/z.md"), document("knowledge/aidlc-shared/a.md"),
    document("knowledge/aidlc-shared/nested/ignored.md"), document("knowledge/aidlc-shared/no.txt"),
    document("knowledge/aidlc-shared/format.md"),
    { ...document("knowledge/aidlc-shared/plugin.md"),
      owner: { kind: "plugin", plugin: brand<PluginId>("example") } },
  ], formatDocuments: new Set(["format.md"]) })).toEqual([
    brand<MethodSourcePath>("knowledge/aidlc-shared/a.md"), brand<MethodSourcePath>("knowledge/aidlc-shared/z.md"),
  ]);
});

test("empty shared knowledge stays empty", () => {
  expect(sharedKnowledgeSources({ documents: [], formatDocuments: new Set() })).toEqual([]);
});
