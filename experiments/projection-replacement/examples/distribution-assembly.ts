import { createDistributionAssembler, type DistributionAssembler, type DistributionSeed } from "../src/application/distribution-assembly.ts";
import { createDistributionSource, createDistributionAssemblyRules, type DistributionSource, type DistributionSourceLocation } from "../src/adapters/distribution-source.ts";
import { createLegacyRunnerCompiler } from "../src/adapters/legacy-runner-compiler.ts";
import type { RunnerCompiler } from "../src/domain/generated-runner.ts";
import type { ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { Outcome } from "../src/domain/model.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { createDistributionCommand, parseDistributionArguments, type DistributionCommand } from "../src/adapters/distribution-command.ts";

export const prepareDistributionSurfaces = ({ seed, text, compiler }: { readonly seed: DistributionSeed; readonly text: string; readonly compiler: RunnerCompiler }): ProjectionSetRequest => ({ target: seed.binding, units: [
  { kind: "skill", key: "session-cost", input: { text, origin: { ...seed.basis, path: "core/skills/aidlc-session-cost/SKILL.md" }, context: { ...seed.binding, invocation: seed.invocation, rulesSubdir: seed.rulesSubdir, memoryRoot: "aidlc/active-memory", modelInvocation: "native-default" } } },
  { kind: "runners", key: "workflow", input: { compiler, context: { ...seed.binding, modelInvocation: "native-default" }, requests: [{ kind: "stage", slug: "code-generation" }, { kind: "scope", scope: "bugfix" }, { kind: "init" }, { kind: "compose" }] } },
] });
export type DistributionAssemblyServices = { readonly source: DistributionSource; readonly prepare: typeof prepareDistributionSurfaces; readonly project: typeof projectProjectionSet; readonly assembler: DistributionAssembler; readonly compiler: (input: { readonly location: DistributionSourceLocation; readonly seed: DistributionSeed }) => RunnerCompiler };
export const createDistributionAssemblyServices = (): DistributionAssemblyServices => ({
  source: createDistributionSource(), prepare: prepareDistributionSurfaces, project: projectProjectionSet,
  assembler: createDistributionAssembler({ rules: createDistributionAssemblyRules() }),
  compiler: ({ location, seed }) => createLegacyRunnerCompiler({ runtime: { root: location.root, binding: seed.binding }, compiler: { ...seed.basis, path: "core/tools/aidlc-runner-gen.ts" } }),
});
export const assembleSourceDistribution = async ({ location, services = createDistributionAssemblyServices() }: { readonly location: DistributionSourceLocation; readonly services?: DistributionAssemblyServices }): Promise<Outcome<Uint8Array>> => {
  const loaded = await services.source.load(location);
  if (loaded.status === "invalid") return loaded;
  const skill = await services.source.skill(location);
  if (skill.status === "invalid") return skill;
  const request = services.prepare({ seed: loaded.value, text: skill.value, compiler: services.compiler({ location, seed: loaded.value }) });
  const projected = services.project(request);
  if (projected.status === "invalid") return projected;
  const assembled = services.assembler.assemble({ seed: loaded.value, projection: projected.value });
  if (assembled.status === "invalid") return assembled;
  return services.source.archive({ sourceRoot: location.sourceRoot, distribution: assembled.value });
};
export type DistributionArchiveCommandServices = { readonly parse: typeof parseDistributionArguments; readonly assemble: typeof assembleSourceDistribution; readonly command: DistributionCommand };
export const createDistributionArchiveCommandServices = (): DistributionArchiveCommandServices => ({ parse: parseDistributionArguments, assemble: assembleSourceDistribution, command: createDistributionCommand() });
export const distributionArchiveCommand = async ({ argv, services = createDistributionArchiveCommandServices() }: { readonly argv: readonly string[]; readonly services?: DistributionArchiveCommandServices }): Promise<void> => {
  const parsed = services.parse({ argv });
  await services.command.finish({ outcome: parsed.status === "invalid" ? parsed : await services.assemble(parsed.value) });
};
if (import.meta.main) await distributionArchiveCommand({ argv: Bun.argv.slice(2) });
