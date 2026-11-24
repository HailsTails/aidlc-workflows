import { expect } from "bun:test";

export function assertDefined<Fixture>(fixture: Fixture | undefined): asserts fixture is Fixture {
  expect(fixture).toBeDefined();
}
