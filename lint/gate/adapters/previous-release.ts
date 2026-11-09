import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Loaded, Workspace } from "../application/ports.ts";

const RecordSchema = z.object({
  release: z.string().min(1), sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  location: z.string().min(1), stamps: z.array(z.string().min(1)).length(7),
});
const StampSchema = z.object({ frameworkVersion: z.string() });
const RECORD = "lint/gate/previous-release.json";

export const previousRelease = (request: {
  readonly workspace: Workspace;
  readonly beside: (location: string) => string;
}): Loaded<string> => {
  const record = RecordSchema.parse(JSON.parse(request.workspace.read(RECORD) ?? "{}"));
  const location = request.beside(record.location);
  try {
    for (const path of record.stamps) {
      const stamp = StampSchema.parse(JSON.parse(readFileSync(join(location, path), "utf8")));
      if (stamp.frameworkVersion !== record.release) {
        throw new Error(`expected release ${record.release}: ${path}`);
      }
    }
    return { ok: true, value: location };
  } catch {
    return {
      ok: false,
      problem: `retained release ${record.release} is missing or mismatched at ${location}`,
      fix: `Restore the retained dist from source ${record.sourceCommit} to ${location}; ` +
        `verify the seven stamps in ${RECORD}. Do not substitute the current dist.`,
    };
  }
};
