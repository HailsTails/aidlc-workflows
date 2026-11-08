import { describe, expect, test } from "bun:test";
import { brand, type Brand } from "./brand.ts";

type Label = Brand<string, "Label">;

type Count = Brand<number, "Count">;

type Coordinate = Brand<{ readonly x: number; readonly y: number }, "Coordinate">;

describe("brand", () => {
  test("returns a branded text as the same text", () => {
    expect(brand<Label>("ready")).toBe<string>("ready");
  });

  test("returns a branded number as the same number", () => {
    expect(brand<Count>(3)).toBe<number>(3);
  });

  test("returns a branded object with the same fields", () => {
    expect(brand<Coordinate>({ x: 1, y: 2 })).toEqual<{ x: number; y: number }>({ x: 1, y: 2 });
  });

  test("returns the very object it was given", () => {
    const origin = { x: 0, y: 0 };
    expect(brand<Coordinate>(origin)).toBe<{ x: number; y: number }>(origin);
  });
});
