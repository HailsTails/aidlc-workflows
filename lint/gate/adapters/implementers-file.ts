import { z } from "zod";
import type { ImplementerFiles } from "../domain/isolation.ts";
import type { Workspace } from "../application/ports.ts";

const ImplementersDocument = z.object({
  implementers: z.array(z.object({ file: z.string(), hermeticTest: z.string() })),
});

const NONE: readonly ImplementerFiles[] = [];

export const implementersFile = (request: {
  readonly workspace: Workspace;
  readonly path: string;
}): (() => readonly ImplementerFiles[]) => () => {
  const text = request.workspace.read(request.path);
  if (text === undefined) {
    return NONE;
  }
  const parsed = ImplementersDocument.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data.implementers : NONE;
};
