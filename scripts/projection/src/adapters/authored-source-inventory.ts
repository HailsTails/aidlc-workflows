import { z } from "zod";
import type { WorkflowSourceDirectory } from "../domain/workflow-source-inputs.ts";
const walker = z.object({ walkFiles: z.function({ input: [z.string()] }) });
export type AuthoredSourceInventory = {
  readonly read: (input: { readonly sourceRoot: string; readonly directory: WorkflowSourceDirectory | "core/skills" | "core/knowledge" | "core/agents" | "core/sensors" | "core/aidlc-common/protocols" | "core/memory" | "core/tools/data"; readonly encoding?: "utf8" | "bytes" }) => Promise<unknown>;
  readonly conductor: (input: { readonly sourceRoot: string }) => Promise<unknown>;
};
export const createAuthoredSourceInventory = (): AuthoredSourceInventory => ({ read: async ({ sourceRoot, directory, encoding = "utf8" }) => {
  const imported: unknown = await import(Bun.pathToFileURL(`${sourceRoot}/core/tools/aidlc-distribution.ts`).href);
  const paths = z.array(z.string()).parse(walker.parse(imported).walkFiles(`${sourceRoot}/${directory}`));
  return Promise.all(paths.map(async (relative) => encoding === "bytes" ? { path: `${directory}/${relative.replaceAll("\\", "/")}`, bytes: await Bun.file(`${sourceRoot}/${directory}/${relative}`).bytes() } : { path: `${directory}/${relative.replaceAll("\\", "/")}`, text: await Bun.file(`${sourceRoot}/${directory}/${relative}`).text() }));
}, conductor: ({ sourceRoot }) => Bun.file(`${sourceRoot}/core/aidlc-common/conductor.md`).text() });
