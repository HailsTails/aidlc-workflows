import { expect, test, vi } from "vitest";

test("uses banned vi.fn implementation argument instead of mockReturnValue", () => {
  const fake = vi.fn(() => "computed-value");
  expect(fake()).toBe("computed-value");
});
