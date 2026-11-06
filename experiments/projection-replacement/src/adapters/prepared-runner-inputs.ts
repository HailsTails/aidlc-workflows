import { z } from "zod";
import type { RunnerInputSnapshot } from "../domain/generated-runner.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { RunnerRuntime } from "./runner-process.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import { createPreparedDirectoryReader, type PreparedDirectoryReader, type PreparedDirectoryRows } from "./prepared-directory.ts";
const inventorySchema = z.strictObject({ files: z.array(z.strictObject({ path: z.string().refine((path) => pathStatus({ path }) === "safe"), bytes: z.instanceof(Uint8Array) })), directories: z.array(z.strictObject({ path: z.string().refine((path) => pathStatus({ path }) === "safe") })) });
const metadataSchema = z.object({ schemaVersion: z.literal(1), distribution: z.string(), harnessDir: z.string(), rulesSubdir: z.enum(["rules", "aidlc-rules", "steering"]) });
export type PreparedRunnerLocation = RunnerRuntime & { readonly basis: SourceBasis };
export type PreparedRunnerInputOperations = { readonly snapshot: (input: { readonly location: PreparedRunnerLocation }) => Promise<Outcome<unknown>> };
export type PreparedRunnerInputs = { readonly load: (input: { readonly location: PreparedRunnerLocation }) => Promise<Outcome<RunnerInputSnapshot>> };
const collectDirectories = ({ observations }: { readonly observations: readonly Outcome<PreparedDirectoryRows>[] }): Outcome<PreparedDirectoryRows> => {
  const findings = observations.flatMap((observation) => observation.status === "invalid" ? observation.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: observations.flatMap((observation) => observation.status === "ok" ? observation.value : []) };
};
const readPreparedSnapshot = async ({ location, directories }: { readonly location: PreparedRunnerLocation; readonly directories: PreparedDirectoryRows }): Promise<Outcome<unknown>> => {
  try {
    const engine = location.binding.directory;
    const scopes = Array.from(new Bun.Glob("*.md").scanSync({ cwd: `${location.root}/${engine}/scopes`, onlyFiles: true, followSymlinks: false, dot: true })).sort();
    const paths = ["tools/data/harness.json", "tools/data/stage-graph.json", "tools/data/scope-grid.json", ...scopes.map((name) => `scopes/${name}`)].map((path) => `${engine}/${path}`);
    const files = await Promise.all(paths.map(async (path) => ({ path, bytes: await Bun.file(`${location.root}/${path}`).bytes() })));
    return { status: "ok", value: { files, directories } };
  } catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "prepared-runner-inputs", detail: "prepared runner snapshot files unavailable" })] }; }
};
const continueSnapshot = <Previous, Next>({ admitted, consume }: { readonly admitted: Outcome<Previous>; readonly consume: (prepared: Previous) => Promise<Outcome<Next>> }): Promise<Outcome<Next>> => admitted.status === "invalid" ? Promise.resolve(admitted) : consume(admitted.value);
export type PreparedSnapshotReader = (input: { readonly location: PreparedRunnerLocation; readonly directories: PreparedDirectoryRows }) => Promise<Outcome<unknown>>;
export const createPreparedRunnerInputOperations = ({ directories = createPreparedDirectoryReader(), readSnapshot = readPreparedSnapshot }: { readonly directories?: PreparedDirectoryReader; readonly readSnapshot?: PreparedSnapshotReader } = {}): PreparedRunnerInputOperations => ({
  snapshot: async ({ location }) => continueSnapshot({ admitted: collectDirectories({ observations: await Promise.all(["skills", "scopes"].map((name) => directories.read({ root: location.root, path: `${location.binding.directory}/${name}` }))) }), consume: (observed) => readSnapshot({ location, directories: observed }) }),
});
const admitSnapshot = ({ inventory, location }: { readonly inventory: z.infer<typeof inventorySchema>; readonly location: PreparedRunnerLocation }): Outcome<RunnerInputSnapshot> => {
  const harnessFile = inventory.files.find((file) => file.path === `${location.binding.directory}/tools/data/harness.json`);
  if (harnessFile === undefined) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "prepared-runner-inputs", detail: "prepared runtime must include harness metadata" })] };
  let harnessMetadata: unknown;
  try { harnessMetadata = JSON.parse(new TextDecoder().decode(harnessFile.bytes)); }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "prepared-runner-inputs", detail: "prepared harness metadata must be valid JSON" })] }; }
  const parsed = metadataSchema.safeParse(harnessMetadata);
  if (!parsed.success || parsed.data.distribution !== location.binding.harness || parsed.data.harnessDir !== location.binding.directory) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "prepared-runner-inputs", detail: "prepared harness metadata must declare version 1, the requested binding and native rules directory" })] };
  if (new Set(inventory.files.map((file) => file.path)).size !== inventory.files.length || new Set(inventory.directories.map((directory) => directory.path)).size !== inventory.directories.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "prepared-runner-inputs", detail: "prepared input files and directories must each be unique" })] };
  return { status: "ok", value: { basis: location.basis, binding: location.binding, files: inventory.files, directories: inventory.directories } };
};
export const createPreparedRunnerInputs = ({ operations = createPreparedRunnerInputOperations() }: { readonly operations?: PreparedRunnerInputOperations } = {}): PreparedRunnerInputs => ({
  load: async ({ location }) => {
    try {
      const snapshot = await operations.snapshot({ location });
      return await continueSnapshot({ admitted: snapshot, consume: async (candidates) => {
        const inventory = inventorySchema.safeParse(candidates);
        return inventory.success ? admitSnapshot({ inventory: inventory.data, location }) : { status: "invalid", findings: [finding({ code: "invalid-input", subject: "prepared-runner-inputs", detail: "prepared input snapshot requires safe file paths, byte contents and directory paths" })] };
      } });
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "prepared-runner-inputs", detail: `prepared runner inputs unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
