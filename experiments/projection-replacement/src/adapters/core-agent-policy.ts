import { z } from "zod";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { continuePreparation } from "../application/preparation-result.ts";
import { finding, type NativeTier, type Outcome, type Tier } from "../domain/model.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { SourceBasis, SourceContentDigest } from "../domain/source-origin.ts";
import type { PreparedCoreAgentPolicy } from "../domain/core-agent-policy.ts";

const modulePath = "core/tools/aidlc-tiers.ts";
const paths = [modulePath, "core/memory/org.md", "core/memory/team.md", "core/memory/project.md"];
const tierSchema = z.enum(["judgment", "balanced", "templated"]).nullable();
const projectionSchema = z.strictObject({ model: z.string().min(1).nullable().optional(), effort: z.enum(["low", "medium", "high", "xhigh", "max"]).nullable().optional() });
const missingFileSchema = z.object({ code: z.enum(["ENOENT", "ENOTDIR"]) });
type NativePolicyApi = {
  readonly readMemoryCap: (memoryDir: string) => unknown;
  readonly projectTier: (...nativeArguments: readonly [tier: Tier, harness: "claude", cap: Tier | null]) => unknown;
};
const moduleSchema = z.unknown().refine((namespace) => typeof namespace === "object" && namespace !== null && Object.hasOwn(namespace, "readMemoryCap") && Object.hasOwn(namespace, "projectTier")).pipe(z.object({
  readMemoryCap: z.custom<NativePolicyApi["readMemoryCap"]>((capability) => typeof capability === "function"),
  projectTier: z.custom<NativePolicyApi["projectTier"]>((capability) => typeof capability === "function"),
}));
type PolicyObservation = { readonly path: string; readonly bytes: Uint8Array | null };
type NativePolicyProjection = { readonly cap: Tier | null; readonly tiers: PreparedCoreAgentPolicy["models"]["tiers"] };
export type CoreAgentPolicyLocation = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly binding: HarnessBinding };
export type CoreAgentPolicySourceOperations = {
  readonly read: (input: { readonly sourceRoot: string; readonly path: string }) => Promise<Outcome<Uint8Array | null>>;
  readonly module: (input: { readonly sourceRoot: string; readonly path: string; readonly sha256: string }) => Promise<Outcome<unknown>>;
  readonly digest: (input: { readonly bytes: Uint8Array }) => string;
};
export type CoreAgentPolicyReader = { readonly load: (input: CoreAgentPolicyLocation) => Promise<Outcome<PreparedCoreAgentPolicy>> };

const unavailablePolicy = ({ detail }: { readonly detail: string }): Outcome<never> => ({ status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-agent-policy", detail })] });
const readPolicySource = async ({ sourceRoot, path }: { readonly sourceRoot: string; readonly path: string }): Promise<Outcome<Uint8Array | null>> => {
  try { return { status: "ok", value: await Bun.file(`${sourceRoot}/${path}`).bytes() }; }
  catch (error) { return missingFileSchema.safeParse(error).success ? { status: "ok", value: null } : unavailablePolicy({ detail: `agent policy source unavailable: ${path}` }); }
};
const loadPolicyModule = async ({ sourceRoot, path, sha256 }: { readonly sourceRoot: string; readonly path: string; readonly sha256: string }): Promise<Outcome<unknown>> => {
  try { return { status: "ok", value: await import(`${Bun.pathToFileURL(`${sourceRoot}/${path}`).href}?source=${sha256}`) }; }
  catch { return unavailablePolicy({ detail: "native tier module could not be loaded; inspect core/tools/aidlc-tiers.ts and its imports" }); }
};
export const createCoreAgentPolicySourceOperations = (): CoreAgentPolicySourceOperations => ({
  read: readPolicySource,
  module: loadPolicyModule,
  digest: createOwnershipDigest(),
});

const admitPolicyLocation = ({ location }: { readonly location: CoreAgentPolicyLocation }): Outcome<CoreAgentPolicyLocation> => {
  if (location.basis.source.kind !== "core" || location.basis.source.id !== "framework" || location.basis.pin.trim().length === 0) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-agent-policy", detail: "declare the framework source basis before preparing core agent model policy" })] };
  if (location.binding.harness !== "claude" || location.binding.directory !== ".claude") return { status: "invalid", findings: [finding({ code: "inapplicable-agent-context", subject: "core-agent-policy", detail: "the qualified core agent policy profile requires Claude with .claude" })] };
  return { status: "ok", value: location };
};
const observePolicySources = async ({ location, source }: { readonly location: CoreAgentPolicyLocation; readonly source: CoreAgentPolicySourceOperations }): Promise<Outcome<readonly PolicyObservation[]>> => {
  const reads = await Promise.all(paths.map(async (path) => ({ path, observed: await source.read({ sourceRoot: location.sourceRoot, path }) })));
  const findings = reads.flatMap(({ observed }) => observed.status === "invalid" ? observed.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: reads.flatMap(({ path, observed }) => observed.status === "ok" ? [{ path, bytes: observed.value }] : []) };
};
const policyWitnesses = ({ observations, source }: { readonly observations: readonly PolicyObservation[]; readonly source: CoreAgentPolicySourceOperations }): readonly SourceContentDigest[] => observations.flatMap(({ path, bytes }) => bytes === null ? [] : [{ path, sha256: source.digest({ bytes }) }]);
const projectNativeTier = ({ api, tier, cap }: { readonly api: NativePolicyApi; readonly tier: Tier; readonly cap: Tier | null }): Outcome<NativeTier> => {
  try {
    const projected = projectionSchema.safeParse(api.projectTier(tier, "claude", cap));
    return projected.success ? { status: "ok", value: { model: projected.data.model ?? null, effort: projected.data.effort ?? null } } : { status: "invalid", findings: [finding({ code: "invalid-tier-mapping", subject: modulePath, detail: `native Claude ${tier} projection requires supported model and effort fields` })] };
  } catch { return unavailablePolicy({ detail: `native Claude ${tier} projection failed; inspect the tier module capability` }); }
};
const readNativeMemoryCap = ({ api, sourceRoot }: { readonly api: NativePolicyApi; readonly sourceRoot: string }): Outcome<Tier | null> => {
  try {
    const cap = tierSchema.safeParse(api.readMemoryCap(`${sourceRoot}/core/memory`));
    return cap.success ? { status: "ok", value: cap.data } : { status: "invalid", findings: [finding({ code: "invalid-tier-mapping", subject: modulePath, detail: "native memory cap must be a supported tier or null" })] };
  } catch { return unavailablePolicy({ detail: "native memory cap evaluation failed; inspect org.md, team.md and project.md tier_cap declarations" }); }
};
const projectNativePolicy = ({ api, sourceRoot }: { readonly api: NativePolicyApi; readonly sourceRoot: string }): Outcome<NativePolicyProjection> => {
  const cap = readNativeMemoryCap({ api, sourceRoot });
  if (cap.status === "invalid") return cap;
  const judgment = projectNativeTier({ api, tier: "judgment", cap: cap.value });
  const balanced = projectNativeTier({ api, tier: "balanced", cap: cap.value });
  const templated = projectNativeTier({ api, tier: "templated", cap: cap.value });
  if (judgment.status === "invalid") return judgment;
  if (balanced.status === "invalid") return balanced;
  if (templated.status === "invalid") return templated;
  return { status: "ok", value: { cap: cap.value, tiers: { judgment: judgment.value, balanced: balanced.value, templated: templated.value } } };
};
const admitNativePolicy = ({ imported, location }: { readonly imported: unknown; readonly location: CoreAgentPolicyLocation }): Outcome<NativePolicyProjection> => {
  const admitted = moduleSchema.safeParse(imported);
  return admitted.success ? projectNativePolicy({ api: admitted.data, sourceRoot: location.sourceRoot }) : { status: "invalid", findings: [finding({ code: "invalid-input", subject: modulePath, detail: "native tier module must export callable readMemoryCap and projectTier capabilities" })] };
};
const isMatchingObservation = ({ before, after }: { readonly before: PolicyObservation; readonly after: PolicyObservation | undefined }) => before.path === after?.path && (before.bytes === null ? after.bytes === null : after.bytes !== null && before.bytes.length === after.bytes.length && before.bytes.every((byte, index) => byte === after.bytes?.[index]));
const finishPolicyObservation = ({ before, after, projection, inputs, location }: {
  readonly before: readonly PolicyObservation[]; readonly after: readonly PolicyObservation[];
  readonly projection: NativePolicyProjection; readonly inputs: readonly SourceContentDigest[]; readonly location: CoreAgentPolicyLocation;
}): Outcome<PreparedCoreAgentPolicy> => before.some((observation, index) => !isMatchingObservation({ before: observation, after: after[index] }))
  ? unavailablePolicy({ detail: "agent policy module or memory inputs changed during preparation" })
  : { status: "ok", value: { tierCap: projection.cap ?? "judgment", models: { tiers: projection.tiers, explicit: "preserve" }, inputs, origins: inputs.map(({ path }) => ({ ...location.basis, path })) } };
const prepareObservedPolicy = async ({ before, location, source }: { readonly before: readonly PolicyObservation[]; readonly location: CoreAgentPolicyLocation; readonly source: CoreAgentPolicySourceOperations }): Promise<Outcome<PreparedCoreAgentPolicy>> => {
  const inputs = policyWitnesses({ observations: before, source });
  const module = inputs.find(({ path }) => path === modulePath);
  if (module === undefined) return unavailablePolicy({ detail: "native core/tools/aidlc-tiers.ts is required before preparing agent policy" });
  const imported = await source.module({ sourceRoot: location.sourceRoot, path: modulePath, sha256: module.sha256 });
  if (imported.status === "invalid") return imported;
  const projected = admitNativePolicy({ imported: imported.value, location });
  return continuePreparation({ previous: projected, consume: ({ prepared }) => continuePreparation({ previous: observePolicySources({ location, source }), consume: ({ prepared: after }) => finishPolicyObservation({ before, after, projection: prepared, inputs, location }) }) });
};
const readCoreAgentPolicy = async ({ location, source }: { readonly location: CoreAgentPolicyLocation; readonly source: CoreAgentPolicySourceOperations }): Promise<Outcome<PreparedCoreAgentPolicy>> => {
  try { return await continuePreparation({ previous: observePolicySources({ location, source }), consume: ({ prepared: before }) => prepareObservedPolicy({ before, location, source }) }); }
  catch { return unavailablePolicy({ detail: "agent policy source or native capability unavailable during preparation" }); }
};
export const createCoreAgentPolicyReader = ({ source = createCoreAgentPolicySourceOperations() }: { readonly source?: CoreAgentPolicySourceOperations } = {}): CoreAgentPolicyReader => ({ load: (location) => continuePreparation({ previous: admitPolicyLocation({ location }), consume: ({ prepared }) => readCoreAgentPolicy({ location: prepared, source }) }) });
