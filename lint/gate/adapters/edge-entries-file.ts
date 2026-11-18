import { z } from "zod";
import type { EdgeEntry } from "../domain/isolation.ts";
import type { Workspace } from "../application/ports.ts";

const EdgeEntriesDocument = z.object({
  entries: z.array(z.object({ file: z.string(), effects: z.array(z.string()) })),
});

const NONE: readonly EdgeEntry[] = [];

export const edgeEntriesFile = (request: {
  readonly workspace: Workspace;
  readonly path: string;
}): (() => readonly EdgeEntry[]) => () => {
  const text = request.workspace.read(request.path);
  if (text === undefined) {
    return NONE;
  }
  const parsed = EdgeEntriesDocument.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data.entries : NONE;
};
