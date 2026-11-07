import { expect, test } from "bun:test";
import { workerBinding, templateAdmissions, targetAdmissions, incompatibleAdmissionCases, roleAdmissionCases } from "../../support/__tests__/worker-policy-fixtures.ts";
import { bindWorkerAdmissions } from "../../../../../scripts/projection/src/domain/worker-policy.ts";

test("equivalent command admissions bind the named actors and authority without asserting whole-policy equivalence", () => {
  expect(bindWorkerAdmissions({ ...workerBinding, templateAdmissions, targetAdmissions })).toEqual({ status: "ok", value: workerBinding });
});
test("admission ordering and repeated set members do not create false mismatches", () => {
  expect(bindWorkerAdmissions({ ...workerBinding, templateAdmissions, targetAdmissions: { ...targetAdmissions, verbs: { "aidlc-state.ts": ["lookup", "get", "get"] } } })).toEqual({ status: "ok", value: workerBinding });
});
test.each(incompatibleAdmissionCases)("worker policy refuses $label", ({ target }) => {
  expect(bindWorkerAdmissions({ ...workerBinding, templateAdmissions, targetAdmissions: target })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: workerBinding.target.name, detail: "worker policy and command admissions must name their actors and share a pin and admission authority" }] });
});
test.each(roleAdmissionCases)("worker policy refuses $label rather than borrowing privileges", ({ verbs }) => {
  expect(bindWorkerAdmissions({ ...workerBinding, templateAdmissions, targetAdmissions: { ...targetAdmissions, verbs } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: workerBinding.target.name, detail: "worker policy reuse requires equivalent command admissions; select or prepare a role-specific policy" }] });
});
