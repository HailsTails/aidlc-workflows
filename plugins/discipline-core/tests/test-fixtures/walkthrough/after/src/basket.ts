import type { Clock } from "./clock.ts";
import { formatPence } from "./format.ts";

export type Line = { readonly name: string; readonly pence: number };

export type Basket = {
  readonly lines: readonly Line[];
  readonly openedAt: number;
};

export const openBasket = (request: { readonly clock: Clock }): Basket => ({
  lines: [],
  openedAt: request.clock.now(),
});

export const withLine = (request: { readonly basket: Basket; readonly line: Line }): Basket => ({
  ...request.basket,
  lines: [...request.basket.lines, request.line],
});

export const basketTotal = (request: { readonly basket: Basket }): string =>
  formatPence({ pence: request.basket.lines.reduce((pence, line) => pence + line.pence, 0) });

export const basketAge = (request: { readonly basket: Basket; readonly clock: Clock }): number =>
  request.clock.now() - request.basket.openedAt;
