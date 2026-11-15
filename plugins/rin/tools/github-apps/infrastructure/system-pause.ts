import type { PausePort } from "../application/pause-port.ts";

const createSystemPause = (): PausePort => ({
  pauseMilliseconds: (milliseconds) =>
    new Promise((resume) => {
      setTimeout(resume, milliseconds);
    }),
});

export { createSystemPause };
