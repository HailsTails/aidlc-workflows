import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { SweepEntry } from "../domain/sweep.ts";
import type { SweepLedger } from "../application/ports.ts";

const EntrySchema = z.object({
  commit: z.string().min(1),
  result: z.enum(["green", "red"]),
  finishedAt: z.number(),
  durationMs: z.number(),
});

const SWEEPS_FOLDER = "sweeps";

export const sweepLedger = (lockDirectory: string): SweepLedger => {
  const folder = join(lockDirectory, SWEEPS_FOLDER);
  const fileOf = (commit: string): string => join(folder, `${commit}.json`);
  return {
    record: (entry: SweepEntry) => {
      mkdirSync(folder, { recursive: true });
      writeFileSync(fileOf(entry.commit), JSON.stringify(entry, null, 2));
    },
    find: (commit) => {
      try {
        return EntrySchema.parse(JSON.parse(readFileSync(fileOf(commit), "utf8")));
      } catch {
        return undefined;
      }
    },
  };
};
