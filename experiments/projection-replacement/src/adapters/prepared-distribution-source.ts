import { z } from "zod";
import { createDistributionSourceOperations, type DistributionSourceLocation, type DistributionSourceOperations } from "./distribution-source.ts";
import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
const safePath = z.string().transform((path) => path.replaceAll("\\", "/")).refine((path) => pathStatus({ path }) === "safe");
const inventorySchema = z.strictObject({ paths: z.array(safePath), directories: z.array(z.strictObject({ path: safePath, mode: z.number().int().min(0).max(0o777) })) });
const contextSchema = z.object({ harness: z.object({ schemaVersion: z.literal(1), distribution: z.string(), harnessDir: z.string(), rulesSubdir: z.enum(["rules", "aidlc-rules", "steering"]) }), invocation: z.string().min(1) });
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
export const createPreparedDistributionSource = ({ operations = createPreparedDistributionOperations() }: { readonly operations?: PreparedDistributionOperations } = {}): PreparedDistributionSource => ({
  load: async ({ location, binding }) => {
    try {
      const inventory = inventorySchema.safeParse(await operations.inventory(location));
      if (!inventory.success || new Set(inventory.data.paths).size !== inventory.data.paths.length) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "prepared-distribution", detail: "unfinished producer input requires a unique safe native file inventory and directory modes" })] };
      const context = contextSchema.safeParse(await operations.context({ root: location.root, binding }));
      if (!context.success || context.data.harness.distribution !== binding.harness || context.data.harness.harnessDir !== binding.directory) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "prepared-distribution", detail: "unfinished producer metadata must match the requested harness binding and native runtime context" })] };
      const files = await Promise.all(inventory.data.paths.map(async (path) => ({ path, ...await operations.read({ root: location.root, path }) })));
      return { status: "ok", value: { basis: location.basis, binding, rulesSubdir: context.data.harness.rulesSubdir, invocation: context.data.invocation, files, directories: inventory.data.directories } };
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "prepared-distribution", detail: `unfinished native runtime unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
