import { expect, it } from "vitest";
import { Basket } from "./basket.ts";

it("totals its lines", () => {
  const basket = new Basket();
  basket.add({ name: "tea", pence: 250 });

  expect(basket.total()).toBe("£2.50");
});
