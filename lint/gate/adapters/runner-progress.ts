export const RUNNER_PROGRESS_PREFIX = "AIDLC_PROGRESS ";

export const PROGRESS_INTERVAL_MS = 30_000;
const STALE_AFTER_SECONDS = 300;
const MAX_PROGRESS_LINE_LENGTH = 16384;

type Outcome = { readonly status: "PASS" | "FAIL" | "SKIP" };

export const observeProgress = (observe: () => void): void => {
  try {
    observe();
  } catch {
    return;
  }
};
type Snapshot = {
  readonly files: readonly string[];
  readonly outcomes: ReadonlyMap<string, Outcome>;
  readonly logs: string;
};

export const runnerProgress = (now: () => number) => {
  const started = now();
  let advanced = started;
  let event = "selected file inventory ready";
  const active = new Map<string, number>();
  return {
    start: (file: string) => {
      active.set(file, now());
      advanced = now();
      event = `started ${file}`;
    },
    finish: (file: string) => {
      active.delete(file);
      advanced = now();
      event = `file attempt returned: ${file}`;
    },
    line: ({ files, outcomes, logs }: Snapshot): string => {
      const current = files.filter((file) => outcomes.has(file) && !active.has(file));
      const seconds = (time: number) => Math.max(0, Math.floor((now() - time) / 1000));
      const counts = (status: string) =>
        current.filter((file) => outcomes.get(file)?.status === status).length;
      const running = [...active].map(([file, time]) => `${file} (${seconds(time)}s)`);
      const quiet = seconds(advanced);
      const parts = [
        `file outcomes ${current.length}/${files.length} ` +
          `(PASS ${counts("PASS")}, FAIL ${counts("FAIL")}, SKIP ${counts("SKIP")})`,
        `active: ${running.join(", ") || "none observed; dispatch/setup/cleanup may remain"}`,
        `execution elapsed ${seconds(started)}s`,
        `last observed advancement ${quiet}s ago (${event})`,
        `logs: ${logs}`,
        "file counts are not work/time percentages; retries and cleanup may remain",
      ];
      if (quiet >= STALE_AFTER_SECONDS) parts.push(
        "no observed file advancement for 5m; a long file may still be working. " +
        "Inspect the active file log tail and existing deadline/process metadata once; " +
        "silence is not proof of a hang",
      );
      return `${RUNNER_PROGRESS_PREFIX}${parts.join("; ")}`;
    },
  };
};

export const progressLines = (write: (line: string) => void) => {
  let pending = "";
  let dropping = false;
  return (chunk: string): void => {
    for (const part of chunk.split(/(?<=\n)/)) {
      if (!dropping) pending += part;
      if (pending.length > MAX_PROGRESS_LINE_LENGTH) {
        pending = "";
        dropping = true;
      }
      if (!part.endsWith("\n")) continue;
      if (!dropping && pending.startsWith(RUNNER_PROGRESS_PREFIX)) {
        observeProgress(() => write(pending));
      }
      pending = "";
      dropping = false;
    }
  };
};
