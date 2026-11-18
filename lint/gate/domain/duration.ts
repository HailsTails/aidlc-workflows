const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

export const formatDuration = (ms: number): string => {
  const seconds = ms / MS_PER_SECOND;
  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const rest = Math.round(seconds - minutes * SECONDS_PER_MINUTE);
  return `${minutes}m${String(rest).padStart(2, "0")}s`;
};
