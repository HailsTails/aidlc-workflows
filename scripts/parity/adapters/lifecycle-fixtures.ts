import { z } from "zod";
import type { LifecycleRecord } from "../domain/install-lifecycle.ts";
import type { LifecycleFixtures, Workspace } from "../application/ports.ts";

const TreeSchema = z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/));

const StepSchema = z.object({
  exitCode: z.number().int(),
  change: z.object({
    added: TreeSchema,
    changed: TreeSchema,
    removed: z.array(z.string()).readonly(),
  }),
});

const LifecycleSchema = z.object({
  harness: z.string().min(1),
  release: z.string().min(1),
  previousRelease: z.string().min(1),
  fresh: z.object({ exitCode: z.number().int(), tree: TreeSchema }),
  refresh: StepSchema,
  localEdit: StepSchema.extend({ file: z.string().min(1), named: z.boolean() }),
  force: StepSchema,
  upgrade: StepSchema.extend({ previousExitCode: z.number().int() }),
}) satisfies z.ZodType<LifecycleRecord>;

const FixtureFileSchema = z.object({ schemaVersion: z.literal(1), lifecycle: LifecycleSchema });

export type FixtureLayout = {
  readonly directory: string;
  readonly harnesses: () => readonly string[];
};

export const lifecycleFixtures = (request: {
  readonly layout: FixtureLayout;
  readonly workspace: Workspace;
}): LifecycleFixtures => {
  const { layout, workspace } = request;
  const pathOf = (harness: string): string => `${layout.directory}/${harness}.json`;
  return {
    harnesses: layout.harnesses,
    read: (harness) => {
      const text = workspace.read(pathOf(harness));
      return text === undefined
        ? undefined
        : FixtureFileSchema.parse(JSON.parse(text)).lifecycle;
    },
    write: (lifecycle) => {
      const content = `${JSON.stringify({ schemaVersion: 1, lifecycle }, null, 2)}\n`;
      workspace.write({ path: pathOf(lifecycle.harness), content });
    },
  };
};
