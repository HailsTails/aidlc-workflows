import { expect, test } from "bun:test";
import { renderGuidanceDefinition, guidanceDocumentName } from "./core-guidance.ts";
import { preparedConductor, preparedProtocol, conductorProjection, protocolProjection } from "../../../../tests/unit/projection/support/__tests__/core-guidance-fixtures.ts";
test.each([
  [{ kind: "conductor" }, "conductor.md"],
  [{ kind: "protocol", slug: "stage-protocol" }, "protocols/stage-protocol.md"],
] as const)("maps each admitted guidance placement", (placement, expected) => {
  expect(guidanceDocumentName({ placement })).toEqual(expected);
});
test.each([
  [preparedConductor, conductorProjection],
  [preparedProtocol, protocolProjection],
])("projects harness-ready guidance without repeating text preparation", (document, expected) => {
  expect(renderGuidanceDefinition({ document, context: { harness: "claude", directory: ".claude" } })).toEqual({ status: "ok", value: expected });
});
test("another harness's selected bindings cannot bypass context matching", () => {
  expect(renderGuidanceDefinition({ document: { ...preparedConductor, binding: { harness: "kiro", directory: ".kiro" } }, context: { harness: "claude", directory: ".claude" } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "core/aidlc-common/conductor.md", detail: "prepared guidance bindings must match the selected delivery harness" }] });
});
