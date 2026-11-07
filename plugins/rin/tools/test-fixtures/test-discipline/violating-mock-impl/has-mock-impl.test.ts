import { expect, test, vi } from "vitest";

test("uses banned .mockImplementation instead of mockReturnValue", () => {
  const fake = vi.fn();
  fake.mockImplementation(() => "computed-value");
  expect(fake()).toBe("computed-value");
});
