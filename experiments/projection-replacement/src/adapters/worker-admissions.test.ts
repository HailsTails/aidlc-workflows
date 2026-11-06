import { expect, test } from "bun:test";
import { targetAdmissions } from "../../__tests__/worker-policy-fixtures.ts";
import { parseWorkerAdmissions } from "./worker-admissions.ts";

test("native admission facts retain their source owner and actor", () => {
  expect(parseWorkerAdmissions({ input: { "aidlc-state.ts": ["get", "lookup"] }, origin: targetAdmissions.origin, name: targetAdmissions.name })).toEqual({ status: "ok", value: targetAdmissions });
});
test.each([{}, { "../escape.ts": ["get"] }, { "aidlc-state.ts": [""] }, { "aidlc-state.ts": "get" }, null])("invalid admission facts fail at their boundary", (input) => {
  expect(parseWorkerAdmissions({ input, origin: targetAdmissions.origin, name: targetAdmissions.name })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: targetAdmissions.origin.path, detail: "expected a nonempty script-to-admitted-verbs map from the command admission owner" }] });
});
