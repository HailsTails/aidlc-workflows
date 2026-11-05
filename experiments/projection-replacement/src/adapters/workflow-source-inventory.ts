import { z } from "zod";
import type { WorkflowSourceDirectory } from "../domain/workflow-source-inputs.ts";
const walker = z.object({ walkFiles: z.function({ input: [z.string()] }) });
export type WorkflowSourceInventory = { readonly read: (input: { readonly sourceRoot: string; readonly directory: WorkflowSourceDirectory }) => Promise<unknown> };
export const createWorkflowSourceInventory = (): WorkflowSourceInventory => ({ read: async ({ sourceRoot, directory }) => {
  const imported: unknown = await import(Bun.pathToFileURL(`${sourceRoot}/core/tools/aidlc-distribution.ts`).href);
  const paths = z.array(z.string()).parse(walker.parse(imported).walkFiles(`${sourceRoot}/${directory}`));
  return Promise.all(paths.map(async (relative) => ({ path: `${directory}/${relative.replaceAll("\\", "/")}`, text: await Bun.file(`${sourceRoot}/${directory}/${relative}`).text() })));
} });
