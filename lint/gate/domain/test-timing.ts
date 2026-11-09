import { formatDuration } from "./duration.ts";

export type FileTiming = { readonly file: string; readonly ms: number };

const FILE_START = /^=== START (\S+) ===\s*$/;
const FILE_TOTAL = /^Ran \d+ tests? across \d+ files?\. \[([\d.]+)(ms|s)\]\s*$/;

const MS_PER_SECOND = 1000;

const millisecondsOf = (amount: string, unit: string): number =>
  unit === "s" ? Number(amount) * MS_PER_SECOND : Number(amount);

export const fileTimings = (output: string): readonly FileTiming[] => {
  const timings: FileTiming[] = [];
  let current: string | undefined;
  for (const line of output.split(/\r?\n/)) {
    const started = FILE_START.exec(line)?.[1];
    const total = FILE_TOTAL.exec(line);
    if (started !== undefined) {
      current = started;
    } else if (total !== null && current !== undefined) {
      timings.push({ file: current, ms: millisecondsOf(total[1] as string, total[2] as string) });
      current = undefined;
    }
  }
  return timings;
};

export const slowestFiles = (
  timings: readonly FileTiming[],
  count: number,
): readonly FileTiming[] =>
  [...timings].sort((a, b) => b.ms - a.ms).slice(0, count);

export const slowestNote = (timings: readonly FileTiming[], count: number): string => {
  const slowest = slowestFiles(timings, count);
  return slowest.length === 0
    ? ""
    : `slowest files: ${slowest.map(({ file, ms }) => `${file} ${formatDuration(ms)}`).join(", ")}`;
};
