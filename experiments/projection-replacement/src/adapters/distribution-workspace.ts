import { z } from "zod";
import { createDistributionSourceOperations } from "./distribution-source.ts";
import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import { finding, type Outcome } from "../domain/model.ts";
const archiveApi = z.object({ extractTarGz: z.function({ input: [z.string(), z.string()] }) });
export type DistributionWorkspace = { readonly run: <T>(input: { readonly seed: DistributionSeed; readonly sourceRoot: string; readonly consume: (input: { readonly root: string }) => Promise<Outcome<T>> }) => Promise<Outcome<T>> };
export type DistributionWorkspaceOperations = { readonly allocate: () => Promise<string>; readonly materialize: (input: { readonly root: string; readonly seed: DistributionSeed; readonly sourceRoot: string }) => Promise<void>; readonly remove: (input: { readonly root: string }) => Promise<void> };
export const createDistributionWorkspaceOperations = (): DistributionWorkspaceOperations => {
  const allocated = new Set<string>();
  return {
    allocate: async () => { const root = Bun.fileURLToPath(Bun.pathToFileURL(`${process.env["TEMP"] ?? process.env["TMP"] ?? "/tmp"}/aidlc-producer-${crypto.randomUUID()}`)); await Bun.$`mkdir ${root}`.quiet(); allocated.add(root); return root; },
    materialize: async ({ root, seed, sourceRoot }) => {
      const imported: unknown = await import(Bun.pathToFileURL(`${sourceRoot}/core/tools/aidlc-archive.ts`).href);
      const api = archiveApi.parse(imported);
      const bytes = await createDistributionSourceOperations().pack({ sourceRoot, files: seed.files, directories: seed.directories });
      await Bun.write(`${root}/input.tar.gz`, bytes);
      api.extractTarGz(`${root}/input.tar.gz`, `${root}/runtime`);
    },
    remove: async ({ root }) => { if (!allocated.has(root)) throw new Error("workspace cleanup requires a root allocated by this workspace instance"); await Bun.$`rm -rf ${root}`.quiet(); allocated.delete(root); },
  };
};
export const createDistributionWorkspace = ({ operations = createDistributionWorkspaceOperations() }: { readonly operations?: DistributionWorkspaceOperations } = {}): DistributionWorkspace => ({
  run: async ({ seed, sourceRoot, consume }) => {
    try {
      const root = await operations.allocate();
      try {
        await operations.materialize({ root, seed, sourceRoot });
        return await consume({ root: `${root}/runtime` });
      } finally { await operations.remove({ root }); }
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "distribution-workspace", detail: `private runtime staging unavailable; no artifact issued: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
