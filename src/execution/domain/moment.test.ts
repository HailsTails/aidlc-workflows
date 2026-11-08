import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { orderOf } from "./moment.ts";

describe("orderOf", () => {
  test.each([
    { moment: "2026-11-08T10:00:00Z", reference: "2026-11-08T10:00:01Z", order: "earlier" },
    { moment: "2026-11-08T10:00:01Z", reference: "2026-11-08T10:00:00Z", order: "later" },
    { moment: "2026-11-08T10:00:00Z", reference: "2026-11-08T10:00:00.000Z", order: "same" },
    { moment: "2026-11-08T10:00:00.5Z", reference: "2026-11-08T10:00:00Z", order: "later" },
    { moment: "2026-11-08T10:00:00.05Z", reference: "2026-11-08T10:00:00.4Z", order: "earlier" },
  ] as const)("reads $moment as $order than $reference", ({ moment, reference, order }) => {
    expect(orderOf(at(moment), at(reference))).toBe(order);
  });
});
