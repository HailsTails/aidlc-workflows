import { z } from "zod";
import { createDistributionSource } from "./distribution-source.ts";
import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import { withTemporaryDirectory, type TemporaryDirectoryOperations } from "../application/temporary-directory.ts";
import type { DistributionDirectoryFactory } from "./distribution-directory.ts";
import { createOwnedTemporaryDirectoryOperations, createTemporaryDirectoryOperations } from "./temporary-directory.ts";
import { finding, type Outcome } from "../domain/model.ts";
const archiveApi = z.object({ extractTarGz: z.function({ input: [z.string(), z.string()] }) });
export type DistributionWorkspace = { readonly run: <T>(input: { readonly seed: DistributionSeed; readonly sourceRoot: string; readonly consume: (input: { readonly root: string }) => Promise<Outcome<T>> }) => Promise<Outcome<T>> };
export type DistributionWorkspaceOperations = TemporaryDirectoryOperations & { readonly materialize: (input: { readonly root: string; readonly seed: DistributionSeed; readonly sourceRoot: string }) => Promise<Outcome<"materialized">> };
const extractWorkspaceArchive = async ({ root, sourceRoot, bytes }: { readonly root: string; readonly sourceRoot: string; readonly bytes: Uint8Array }): Promise<Outcome<"materialized">> => {
  try {
    const imported: unknown = await import(Bun.pathToFileURL(`${sourceRoot}/core/tools/aidlc-archive.ts`).href);
    const api = archiveApi.parse(imported);
    await Bun.write(`${root}/input.tar.gz`, bytes);
    api.extractTarGz(`${root}/input.tar.gz`, `${root}/runtime`);
    return { status: "ok", value: "materialized" };
  } catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "distribution-workspace", detail: "workspace archive extraction unavailable; no artifact issued" })] }; }
};
const continueWorkspace = async <Previous, Next>({ previous, consume }: { readonly previous: Outcome<Previous> | Promise<Outcome<Previous>>; readonly consume: (prepared: Previous) => Promise<Outcome<Next>> }): Promise<Outcome<Next>> => {
  const resolved = await previous;
  return resolved.status === "invalid" ? resolved : consume(resolved.value);
};
// Omitted and explicitly undefined factories both preserve standalone scratch allocation.
export const createDistributionWorkspaceOperations = ({ directories }: { readonly directories?: DistributionDirectoryFactory | undefined } = {}): DistributionWorkspaceOperations => {
  return {
    ...(directories === undefined ? createTemporaryDirectoryOperations() : createOwnedTemporaryDirectoryOperations({ directories: directories() })),
    materialize: ({ root, seed, sourceRoot }) => continueWorkspace({ previous: createDistributionSource().archive({ sourceRoot, distribution: seed }), consume: (bytes) => extractWorkspaceArchive({ root, sourceRoot, bytes }) }),
  };
};
export const createDistributionWorkspace = ({ directories, operations = createDistributionWorkspaceOperations({ directories }) }: { readonly directories?: DistributionDirectoryFactory | undefined; readonly operations?: DistributionWorkspaceOperations } = {}): DistributionWorkspace => ({
  run: ({ seed, sourceRoot, consume }) => withTemporaryDirectory({ directories: operations, consume: ({ root }) => continueWorkspace({ previous: operations.materialize({ root, seed, sourceRoot }), consume: async () => consume({ root: `${root}/runtime` }) }) }),
});
