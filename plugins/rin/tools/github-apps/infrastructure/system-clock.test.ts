import { afterEach, describe, expect, it, vi } from "vitest";
import { createSystemClock } from "./system-clock.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("createSystemClock", () => {
  it("reads the current instant in whole epoch seconds", () => {
    vi.useFakeTimers({ now: 1_700_000_000_999 });

    expect(createSystemClock().nowEpochSeconds()).toBe(1_700_000_000);
  });
});
