import { createNativeDistributionContextReader } from "./distribution-context.ts";
import type { DistributionContextReader, PreparedDistributionContext } from "../domain/distribution-context.ts";
import { planPreparedRuntimeFiles } from "../domain/prepared-runtime-files.ts";
import { createDistributionAssemblyRules } from "./distribution-source.ts";
import { z } from "zod";
import { createDistributionSourceOperations, type DistributionSourceLocation, type DistributionSourceOperations } from "./distribution-source.ts";
import type { DistributionSeed, DistributionFile, DistributionDirectory } from "../domain/distribution-artifact.ts";
import type { RuntimeInputPreparation } from "../domain/runtime-inputs.ts";
import type { DistributionAssemblyRules } from "../application/distribution-assembly.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
const safePath = z.string().transform((path) => path.replaceAll("\\", "/")).refine((path) => pathStatus({ path }) === "safe");
const inventorySchema = z.strictObject({ paths: z.array(safePath), directories: z.array(z.strictObject({ path: safePath, mode: z.number().int().min(0).max(0o777) })) });
const walkerSchema = z.object({ walkFiles: z.function({ input: [z.string()] }) });
export type PreparedDistributionSource = { readonly load: (input: { readonly location: DistributionSourceLocation; readonly binding: HarnessBinding }) => Promise<Outcome<DistributionSeed>> };
export type PreparedDistributionOperations = Pick<DistributionSourceOperations, "context" | "read"> & { readonly inventory: (input: { readonly sourceRoot: string; readonly root: string }) => Promise<unknown> };
export const createPreparedDistributionOperations = (): PreparedDistributionOperations => ({
  ...createDistributionSourceOperations(),
  inventory: async ({ sourceRoot, root }) => {
    const imported: unknown = await import(Bun.pathToFileURL(`${sourceRoot}/core/tools/aidlc-distribution.ts`).href);
    const paths: unknown = walkerSchema.parse(imported).walkFiles(root);
    const candidates = Array.from(new Bun.Glob("**/*").scanSync({ cwd: root, onlyFiles: false, followSymlinks: false, dot: true })).sort();
    const directories = (await Promise.all(candidates.map(async (path) => { const stat = await Bun.file(`${root}/${path}`).stat(); return stat.isDirectory() ? [{ path, mode: stat.mode & 0o777 }] : []; }))).flat();
    return { paths, directories };
  },
});
const contextEvidence = ({ prepared }: { readonly prepared: PreparedDistributionContext }): { readonly inputPreparations?: readonly RuntimeInputPreparation[] } => prepared.files.length === 0 ? {} : { inputPreparations: [{ kind: "context", paths: prepared.files.map((file) => file.path), inputs: prepared.inputs }] };
const finishPreparedContext = ({ location, binding, prepared, files, directories, admit, rules }: { readonly location: DistributionSourceLocation; readonly binding: HarnessBinding; readonly prepared: PreparedDistributionContext; readonly files: readonly DistributionFile[]; readonly directories: readonly DistributionDirectory[]; readonly admit: typeof planPreparedRuntimeFiles; readonly rules: Pick<DistributionAssemblyRules, "path"> }): Outcome<DistributionSeed> => {
  if (prepared.context.binding.harness !== binding.harness || prepared.context.binding.directory !== binding.directory) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "prepared-distribution", detail: "prepared context must preserve the inventory's requested harness binding" })] };
  const seed = { basis: location.basis, binding, rulesSubdir: prepared.context.rulesSubdir, invocation: prepared.context.invocation, files, directories };
  const additions = admit({ candidates: prepared.files, inventory: seed, rules });
  return additions.status === "invalid" ? additions : { status: "ok", value: { ...seed, files: [...files, ...additions.value.additions], ...contextEvidence({ prepared }) } };
};
export const createPreparedDistributionSource = ({ operations = createPreparedDistributionOperations(), context = createNativeDistributionContextReader({ read: operations.context }), admit = planPreparedRuntimeFiles, rules = createDistributionAssemblyRules() }: { readonly operations?: PreparedDistributionOperations; readonly context?: DistributionContextReader; readonly admit?: typeof planPreparedRuntimeFiles; readonly rules?: Pick<DistributionAssemblyRules, "path"> } = {}): PreparedDistributionSource => ({
  load: async ({ location, binding }) => {
    try {
      const inventory = inventorySchema.safeParse(await operations.inventory(location));
      if (!inventory.success || new Set(inventory.data.paths).size !== inventory.data.paths.length) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "prepared-distribution", detail: "unfinished producer input requires a unique safe native file inventory and directory modes" })] };
      const preparedContext = await context.load({ location, binding });
      if (preparedContext.status === "invalid") return preparedContext;
      const files = await Promise.all(inventory.data.paths.map(async (path) => ({ path, ...await operations.read({ root: location.root, path }) })));
      return finishPreparedContext({ location, binding, prepared: preparedContext.value, files, directories: inventory.data.directories, admit, rules });
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "prepared-distribution", detail: `unfinished native runtime unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
