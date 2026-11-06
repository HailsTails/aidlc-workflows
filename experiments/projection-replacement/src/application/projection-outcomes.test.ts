import { expect, test } from "bun:test";
import { successful } from "../../__tests__/support.ts";
import { collectProjectionOutcomes } from "./projection-outcomes.ts";

test("empty projection batch succeeds", () => {
  expect(collectProjectionOutcomes({ outcomes: [] })).toEqual({ status: "ok", value: [] });
});
test("successful projections retain order and freeze the collection", () => {
  const collected = collectProjectionOutcomes({
    outcomes: [
      { status: "ok", value: "second" },
      { status: "ok", value: "first" },
    ],
  });
  expect(collected).toEqual({ status: "ok", value: ["second", "first"] });
  expect(Object.isFrozen(successful(collected))).toBe(true);
});
test("any invalid projection refuses partial success and retains every finding in order", () => {
  expect(
    collectProjectionOutcomes({
      outcomes: [
        {
          status: "invalid",
          findings: [{ code: "unresolved-token", subject: "a", detail: "first" }],
        },
        { status: "ok", value: "discarded" },
        {
          status: "invalid",
          findings: [{ code: "capability-gap", subject: "b", detail: "second" }],
        },
      ],
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      { code: "unresolved-token", subject: "a", detail: "first" },
      { code: "capability-gap", subject: "b", detail: "second" },
    ],
  });
});
test("invalid status cannot become success through an empty findings list", () => {
  expect(collectProjectionOutcomes({ outcomes: [{ status: "invalid", findings: [] }] })).toEqual({
    status: "invalid",
    findings: [],
  });
});
