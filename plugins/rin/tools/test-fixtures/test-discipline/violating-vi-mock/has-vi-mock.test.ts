import { expect, test, vi } from "vitest";

vi.mock("./some-module", () => ({
  someExport: vi.fn(),
}));

test("uses banned vi.mock module-level mock", () => {
  expect(true).toBe(true);
});
