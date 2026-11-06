import { expect, mock, test } from "bun:test";
import { createKnowledgeProjector } from "./knowledge-definition.ts";
import { coreKnowledgeContext, coreKnowledgeOrigin, coreKnowledgeText } from "../../__tests__/core-knowledge-fixtures.ts";
test.each([
  [{ status: "ok", value: "Prepared methodology" }, { status: "ok", value: { origin: coreKnowledgeOrigin, harness: "claude", resources: [{ kind: "file", path: ".claude/knowledge/aidlc-shared/guide.md", body: "Prepared methodology" }] } }],
  [{ status: "invalid", findings: [{ code: "unresolved-token", subject: "core/knowledge/aidlc-shared/guide.md", detail: "unprepared portable instruction" }] }, { status: "invalid", findings: [{ code: "unresolved-token", subject: "core/knowledge/aidlc-shared/guide.md", detail: "unprepared portable instruction" }] }],
] as const)("maps prepared prose or preserves its explicit refusal", (reply, expected) => {
  const prose = mock().mockReturnValue(reply);
  expect(createKnowledgeProjector({ prose }).render({ document: { relativePath: "aidlc-shared/guide.md", origin: coreKnowledgeOrigin, text: coreKnowledgeText }, context: coreKnowledgeContext })).toEqual(expected);
  expect(prose).toHaveBeenCalledWith({ markdown: coreKnowledgeText, context: coreKnowledgeContext, subject: "core/knowledge/aidlc-shared/guide.md" });
});
test("unsupported native-release delivery stops before prose preparation", () => {
  const prose = mock();
  expect(createKnowledgeProjector({ prose }).render({ document: { relativePath: "aidlc-shared/guide.md", origin: coreKnowledgeOrigin, text: coreKnowledgeText }, context: { ...coreKnowledgeContext, invocation: "aidlc" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core/knowledge/aidlc-shared/guide.md", detail: "knowledge text currently qualifies Bun copy delivery; native-release command preparation is a separate capability" }] });
  expect(prose).not.toHaveBeenCalled();
});
