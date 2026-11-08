import { z } from "zod";
import type { DisciplineSelection, Workspace } from "../application/ports.ts";

const SELECTION_FILE = "disciplines.json";

const EXCEPTIONS_FILE = "discipline-exceptions.json";

const SelectionSchema = z.looseObject({
  exclude: z.array(z.string()).optional(),
});

const ExceptionsSchema = z.object({
  version: z.literal(1),
  exceptions: z.array(
    z.looseObject({
      kind: z.string().min(1),
      clause: z.string().min(1),
      file: z.string().min(1).optional(),
    }),
  ),
});

const parsedSelection = (workspace: Workspace): z.infer<typeof SelectionSchema> | undefined => {
  const text = workspace.read(SELECTION_FILE);
  if (text === undefined) {
    return undefined;
  }
  const parsed = SelectionSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : undefined;
};

export const disciplinesFiles = (workspace: Workspace): DisciplineSelection => ({
  excludes: () => parsedSelection(workspace)?.exclude,
  saveExcludes: (entries) => {
    const selection = parsedSelection(workspace) ?? {};
    const content = `${JSON.stringify({ ...selection, exclude: entries }, null, 2)}\n`;
    workspace.write({ path: SELECTION_FILE, content });
  },
  exceptions: () => {
    const text = workspace.read(EXCEPTIONS_FILE);
    if (text === undefined) {
      return { ok: true, value: [] };
    }
    const parsed = ExceptionsSchema.safeParse(JSON.parse(text));
    return parsed.success
      ? {
          ok: true,
          value: parsed.data.exceptions.map(({ kind, clause, file }) => ({ kind, clause, file })),
        }
      : {
          ok: false,
          problem: `does not match its schema: ${z.prettifyError(parsed.error)}`,
          fix: "Restore the file's shape: { version: 1, exceptions: [...] }.",
        };
  },
});
