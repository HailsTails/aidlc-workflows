import { z } from "zod";
import { CONTEXTS, LEGACY_TERRITORY } from "../../context-map.ts";
import type { ContractFiles, Lane, LanePlan } from "../domain/lane-plan.ts";
import type { LanePlanSource, Loaded, Workspace } from "../application/ports.ts";

const TerritoryContextSchema = z.enum(CONTEXTS).exclude(["kernel"]);

const LaneEntrySchema = z.object({
  name: z.string().min(1),
  owns: z.array(z.string().min(1)),
  notOwned: z.array(z.string().min(1)).optional(),
  territory: z.array(TerritoryContextSchema).optional(),
  contractFiles: z.array(z.string().min(1)).optional(),
  monolithDeletions: z.record(z.string(), z.array(z.string().min(1))),
  hotFileGrants: z.record(z.string(), z.array(z.string().min(1))).optional(),
});

const LanesFileSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  hotFiles: z.array(z.string().min(1)),
  lanes: z.record(z.string(), LaneEntrySchema),
});

type LaneEntry = z.infer<typeof LaneEntrySchema>;

type LaneRow = readonly [string, LaneEntry];

const toLane = ([id, entry]: LaneRow): Lane => ({
  id,
  name: entry.name,
  owns: entry.owns,
  territory: (entry.territory ?? []).flatMap((context) => LEGACY_TERRITORY[context]),
  notOwned: entry.notOwned ?? [],
  deletions: Object.entries(entry.monolithDeletions).map(([pattern, declarations]) => ({
    pattern,
    declarations,
  })),
  hotFileGrants: Object.entries(entry.hotFileGrants ?? {}).map(([path, keyPaths]) => ({
    path,
    keyPaths,
  })),
});

const toContracts = ([id, entry]: LaneRow): readonly ContractFiles[] =>
  entry.contractFiles === undefined ? [] : [{ writer: id, files: entry.contractFiles }];

const parsePlan = (text: string): Loaded<LanePlan> => {
  const parsed = LanesFileSchema.safeParse(JSON.parse(text));
  if (parsed.success) {
    const rows = Object.entries(parsed.data.lanes);
    return {
      ok: true,
      value: {
        hotFiles: parsed.data.hotFiles,
        contracts: rows.flatMap(toContracts),
        lanes: rows.map(toLane),
      },
    };
  }
  return {
    ok: false,
    problem: `lanes.json does not match its schema: ${z.prettifyError(parsed.error)}`,
    fix: "Restore lanes.json from the base branch; the gate reads lane ownership from it.",
  };
};

export const lanesFile = (request: {
  readonly workspace: Workspace;
  readonly path: string;
}): LanePlanSource => ({
  load: () => {
    const text = request.workspace.read(request.path);
    return text === undefined
      ? {
          ok: false,
          problem: `${request.path} is missing`,
          fix: "Run the gate from the lane worktree root, where lanes.json lives.",
        }
      : parsePlan(text);
  },
});
