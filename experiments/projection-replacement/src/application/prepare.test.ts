import { expect, test } from "bun:test";
import { parseProjectionRequest } from "./prepare.ts";
import { reviewerRequest } from "../../__tests__/fixtures.ts";
test("unknown boundary rejects incomplete requests", () => {
  expect(
    parseProjectionRequest({ input: { ...reviewerRequest(), documents: undefined } }),
  ).toMatchObject({
    status: "invalid",
    findings: [{ code: "invalid-input", subject: "documents" }],
  });
});
test("unknown boundary retains complete authored input for domain validation", () => {
  const request = reviewerRequest();
  expect(parseProjectionRequest({ input: request })).toEqual({ status: "ok", value: request });
});
test("unknown boundary rejects unexpected request fields", () => {
  expect(
    parseProjectionRequest({ input: { ...reviewerRequest(), ambientReviewerFallback: true } }),
  ).toMatchObject({ status: "invalid", findings: [{ code: "invalid-input", subject: "" }] });
});
