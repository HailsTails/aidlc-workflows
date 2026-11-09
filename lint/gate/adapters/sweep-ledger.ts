import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { SweepEntry } from "../domain/sweep.ts";
import type { SweepLedger } from "../application/ports.ts";

const EntrySchema = z.object({
  commit: z.string().min(1),
  result: z.enum(["green", "red", "pending"]),
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
      const temporary = `${fileOf(entry.commit)}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(entry, null, 2));
      renameSync(temporary, fileOf(entry.commit));
    },
    find: (commit) => {
      try {
        const entry = EntrySchema.parse(JSON.parse(readFileSync(fileOf(commit), "utf8")));
        return entry.commit === commit ? entry : undefined;
      } catch {
        return undefined;
      }
    },
  };
};
