import { z } from "zod";
import type { DistributionFile, DistributionSeed, AssembledDistribution, DistributionAssemblyRules, DistributionDirectory } from "../application/distribution-assembly.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
const functions = z.object({ projectionFiles: z.function({ input: [z.string()] }), walkFiles: z.function({ input: [z.string()] }) });
const archiveFunctions = z.object({ createTarGz: z.function({ input: [z.array(z.unknown())] }) });
const runtimeFunctions = z.object({ aidlcInvocation: z.function({ input: [] }) });
const nativeRefusal = z.object({ status: z.literal("refused"), detail: z.string() });
const binding = z.object({ distribution: z.string(), harnessDir: z.string() });
const bindings: readonly HarnessBinding[] = [{ harness: "claude", directory: ".claude" }, { harness: "cursor", directory: ".cursor" }, { harness: "codex", directory: ".codex" }, { harness: "copilot", directory: ".aidlc" }, { harness: "opencode", directory: ".aidlc" }, { harness: "kiro", directory: ".kiro" }, { harness: "kiro-ide", directory: ".kiro" }];
const safePath = z.string().transform((path) => path.replaceAll("\\", "/")).refine((path) => pathStatus({ path }) === "safe");
const inspectedSchema = z.discriminatedUnion("status", [nativeRefusal, z.object({ status: z.literal("ok"), projection: z.object({ stamp: binding }), paths: z.array(safePath).min(1), directories: z.array(z.object({ path: safePath, mode: z.number().int().min(0).max(0o777) })).refine((directories) => new Set(directories.map((directory) => directory.path)).size === directories.length) })]);
const contextSchema = z.object({ harness: binding.extend({ schemaVersion: z.literal(1), rulesSubdir: z.enum(["rules", "aidlc-rules", "steering"]) }), invocation: z.string().min(1) });
export const createDistributionAssemblyRules = (): DistributionAssemblyRules => ({ path: pathStatus, encode: ({ text }) => new TextEncoder().encode(text) });
export type DistributionSourceLocation = { readonly sourceRoot: string; readonly root: string; readonly basis: SourceBasis };
export type DistributionSourceOperations = {
  readonly skill: (input: { readonly sourceRoot: string }) => Promise<string>;
  readonly inspect: (input: { readonly sourceRoot: string; readonly root: string }) => Promise<unknown>;
  readonly context: (input: { readonly root: string; readonly binding: HarnessBinding }) => Promise<unknown>;
  readonly read: (input: { readonly root: string; readonly path: string }) => Promise<{ readonly bytes: Uint8Array; readonly mode: number }>;
  readonly pack: (input: { readonly sourceRoot: string; readonly files: readonly DistributionFile[]; readonly directories: readonly DistributionDirectory[] }) => Promise<Uint8Array>;
};
export const createDistributionSourceOperations = (): DistributionSourceOperations => ({
  skill: ({ sourceRoot }) => Bun.file(`${sourceRoot}/core/skills/aidlc-session-cost/SKILL.md`).text(),
  inspect: async ({ sourceRoot, root }) => {
    const imported: unknown = await import(Bun.pathToFileURL(`${sourceRoot}/core/tools/aidlc-distribution.ts`).href);
    const api = functions.parse(imported);
    let projection: unknown;
    let paths: unknown;
    try { projection = api.projectionFiles(root); paths = api.walkFiles(root); }
    catch (error) { return { status: "refused", detail: error instanceof Error ? error.message : String(error) }; }
    const directoryCandidates = Array.from(new Bun.Glob("**/*").scanSync({ cwd: root, onlyFiles: false, followSymlinks: false, dot: true })).sort();
    const directories = (await Promise.all(directoryCandidates.map(async (path) => { const stat = await Bun.file(`${root}/${path}`).stat(); return stat.isDirectory() ? [{ path, mode: stat.mode & 0o777 }] : []; }))).flat();
    return { status: "ok", projection, paths, directories };
  },
  context: async ({ root, binding: selected }) => {
    const harness: unknown = await Bun.file(`${root}/${selected.directory}/tools/data/harness.json`).json();
    const importedRuntime: unknown = await import(Bun.pathToFileURL(`${root}/${selected.directory}/tools/aidlc-runtime-paths.ts`).href);
    const runtime = runtimeFunctions.parse(importedRuntime);
    return { harness, invocation: runtime.aidlcInvocation() };
  },
  read: async ({ root, path }) => { const file = Bun.file(`${root}/${path}`); const [bytes, stat] = await Promise.all([file.bytes(), file.stat()]); return { bytes, mode: stat.mode & 0o777 }; },
  pack: async ({ sourceRoot, files, directories }) => {
    const imported: unknown = await import(Bun.pathToFileURL(`${sourceRoot}/core/tools/aidlc-archive.ts`).href);
    const api = archiveFunctions.parse(imported);
    const packed: unknown = api.createTarGz([...directories.map((directory) => ({ path: directory.path, type: "directory", mode: directory.mode, data: Buffer.alloc(0) })), ...files.map((file) => ({ path: file.path, type: "file", mode: file.mode, data: Buffer.from(file.bytes) }))]);
    if (!(packed instanceof Uint8Array)) throw new Error("native archive producer did not return bytes");
    return packed;
  },
});
export type DistributionSource = { readonly skill: (input: { readonly sourceRoot: string }) => Promise<Outcome<string>>; readonly load: (input: DistributionSourceLocation) => Promise<Outcome<DistributionSeed>>; readonly archive: (input: { readonly sourceRoot: string; readonly distribution: AssembledDistribution }) => Promise<Outcome<Uint8Array>> };
export const createDistributionSource = ({ operations = createDistributionSourceOperations() }: { readonly operations?: DistributionSourceOperations } = {}): DistributionSource => ({
  skill: async ({ sourceRoot }) => {
    try { return { status: "ok", value: await operations.skill({ sourceRoot }) }; }
    catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "aidlc-session-cost", detail: `authored skill unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
  load: async ({ sourceRoot, root, basis }) => {
    try {
      const inspected = inspectedSchema.safeParse(await operations.inspect({ sourceRoot, root }));
      if (!inspected.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "distribution-seed", detail: "native distribution inspection must return a supported binding and safe file/directory inventory" })] };
      if (inspected.data.status === "refused") return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "distribution-seed", detail: `native distribution refused: ${inspected.data.detail}` })] };
      const identity = inspected.data.projection.stamp;
      const selected = bindings.find((candidate) => candidate.harness === identity.distribution && candidate.directory === identity.harnessDir);
      if (selected === undefined) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "distribution-seed", detail: "native seed declares an unsupported harness binding" })] };
      const context = contextSchema.safeParse(await operations.context({ root, binding: selected }));
      if (!context.success || context.data.harness.distribution !== selected.harness || context.data.harness.harnessDir !== selected.directory)
        return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "distribution-seed", detail: "native runtime context must declare the seed's binding, rules path and invocation" })] };
      const files = await Promise.all(inspected.data.paths.map(async (path) => ({ path, ...await operations.read({ root, path }) })));
      return { status: "ok", value: { basis, binding: selected, rulesSubdir: context.data.harness.rulesSubdir, invocation: context.data.invocation, files, directories: inspected.data.directories } };
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "distribution-seed", detail: `native seed unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
  archive: async ({ sourceRoot, distribution }) => {
    try { return { status: "ok", value: await operations.pack({ sourceRoot, files: distribution.files, directories: distribution.directories }) }; }
    catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "distribution-archive", detail: `native archive producer unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
