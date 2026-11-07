import type { ClockPort } from "../application/clock-port.ts";

const MILLISECONDS_PER_SECOND = 1000;

const createSystemClock = (): ClockPort => ({
  nowEpochSeconds: () => Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
});

export { createSystemClock };
