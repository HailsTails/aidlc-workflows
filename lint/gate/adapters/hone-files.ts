import { z } from "zod";
import type { DisciplineSelection, Workspace } from "../application/ports.ts";
import type { DisciplineException } from "../domain/zone-rules.ts";

const CONFIG_FILE = "hone.config.json";

const RECORD_FILES = "hone-records/**/*.json";

const FILE_CARVE_OUT = "file-carve-out";

const AUTHORISED_LOCATION = "authorised-location";

const KIND_OF_FOLDER: Readonly<Record<string, string>> = {
  "authorised-locations": AUTHORISED_LOCATION,
  debt: FILE_CARVE_OUT,
};

const ConfigSchema = z.looseObject({
  exclude: z.array(z.string()).optional(),
});

const RecordsSchema = z.object({
  version: z.literal(2),
  records: z.array(
    z.looseObject({
      answers: z.string().min(1),
      file: z.string().min(1),
    }),
  ),
});

const parsedConfig = (workspace: Workspace): z.infer<typeof ConfigSchema> | undefined => {
  const text = workspace.read(CONFIG_FILE);
  if (text === undefined) {
    return undefined;
  }
  const parsed = ConfigSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : undefined;
};

const folderOf = (path: string): string | undefined => path.split("/")[1];

export const honeFiles = (workspace: Workspace): DisciplineSelection => ({
  excludes: () => parsedConfig(workspace)?.exclude,
  saveExcludes: (entries) => {
    const config = parsedConfig(workspace) ?? {};
    const content = `${JSON.stringify({ ...config, exclude: entries }, null, 2)}\n`;
    workspace.write({ path: CONFIG_FILE, content });
  },
  exceptions: () => {
    const exceptions: DisciplineException[] = [];
    for (const path of workspace.filesMatching([RECORD_FILES])) {
      const kind = KIND_OF_FOLDER[folderOf(path) ?? ""];
      const text = workspace.read(path);
      if (kind === undefined || text === undefined) {
        continue;
      }
      const parsed = RecordsSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        return {
          ok: false,
          problem: `${path} does not match its schema: ${z.prettifyError(parsed.error)}`,
          fix: "Restore the file's shape: { version: 2, records: [...] }.",
        };
      }
      exceptions.push(
        ...parsed.data.records.map(({ answers, file }) => ({ kind, clause: answers, file })),
      );
    }
    return { ok: true, value: exceptions };
  },
});
