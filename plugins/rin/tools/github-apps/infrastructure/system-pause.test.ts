import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSystemPause } from "./system-pause.ts";

describe("createSystemPause", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays paused until the full pause has elapsed", async () => {
    const resumed = vi.fn<() => void>();
    createSystemPause().pauseMilliseconds(250).then(resumed);

    await vi.advanceTimersByTimeAsync(249);

    expect(resumed).not.toHaveBeenCalled();
  });

  it("resumes once the pause has elapsed", async () => {
    const resumed = vi.fn<() => void>();
    createSystemPause().pauseMilliseconds(250).then(resumed);

    await vi.advanceTimersByTimeAsync(250);

    expect(resumed).toHaveBeenCalledOnce();
  });
});
