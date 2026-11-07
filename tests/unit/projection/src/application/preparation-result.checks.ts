import { expect, mock, test } from "bun:test";
import { continuePreparation } from "../../../../../scripts/projection/src/application/preparation-result.ts";
test("passes admitted values through a labelled continuation", async () => {
  const consume = mock().mockResolvedValue({ status: "ok", value: "published" });
  expect(await continuePreparation({ previous: { status: "ok", value: ["first", "second"] }, consume })).toEqual({ status: "ok", value: "published" });
  expect(consume).toHaveBeenCalledWith({ prepared: ["first", "second"] });
});
test("an awaited refusal stops the next preparation stage", async () => {
  const consume = mock();
  expect(await continuePreparation({ previous: Promise.resolve({ status: "invalid", findings: [{ code: "capability-gap", subject: "source", detail: "source unavailable" }] }), consume })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source", detail: "source unavailable" }] });
  expect(consume).not.toHaveBeenCalled();
});
