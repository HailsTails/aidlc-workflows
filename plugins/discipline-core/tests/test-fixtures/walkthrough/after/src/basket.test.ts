import { expect, it } from "vitest";
import { basketAge, basketTotal, openBasket, withLine } from "./basket.ts";

const clockAt = (request: { readonly now: number }) => ({ now: () => request.now });

it("totals its lines", () => {
  const basket = withLine({ basket: openBasket({ clock: clockAt({ now: 0 }) }), line: { name: "tea", pence: 250 } });

  expect(basketTotal({ basket })).toBe("£2.50");
});

it("measures its age from the clock it was opened with", () => {
  const basket = openBasket({ clock: clockAt({ now: 1000 }) });

  expect(basketAge({ basket, clock: clockAt({ now: 1500 }) })).toBe(500);
});
