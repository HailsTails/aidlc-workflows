import { expect, test } from "bun:test";
import { accepted } from "../../../kernel/result.ts";
import { withSharedKnowledge } from "./shared-knowledge.ts";

test("unchanged JSON preserves authored key order and formatting", () => {
  const text = '{ "custom": true, "resources": [], "name": "aidlc" }\n';
  expect(withSharedKnowledge(text, { documents: [], formatDocuments: new Set() }))
    .toEqual(accepted(text));
});

test("expanded JSON retains key order and non-resource fields", () => {
  expect(withSharedKnowledge(
    '{"custom":true,"resources":["file://.kiro/knowledge/aidlc-shared/*.md"],"name":"aidlc"}',
    { documents: [], formatDocuments: new Set() },
  )).toEqual(accepted('{\n  "custom": true,\n  "resources": [],\n  "name": "aidlc"\n}\n'));
});
