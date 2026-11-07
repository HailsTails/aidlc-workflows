import { qualifiedHarnessProfile, type QualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { z } from "zod";
import { lstatSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations } from "./native-compiler-process.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { continuePreparation } from "../application/preparation-result.ts";
import { finding, type NativeTier, type Outcome, type Tier } from "../domain/model.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { SourceBasis, SourceContentDigest } from "../domain/source-origin.ts";
import type { PreparedCoreAgentPolicy } from "../domain/core-agent-policy.ts";

const modulePath = "core/tools/aidlc-tiers.ts";
const paths = [modulePath, "core/memory/org.md", "core/memory/team.md", "core/memory/project.md"];
const tierSchema = z.enum(["judgment", "balanced", "templated"]).nullable();
function rawTierProjection(value: unknown): NativeTier | null {
  if (value === null || typeof value !== "object") return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length > 0 || Object.keys(fields).some(key => !["model", "effort"].includes(key) || !("value" in fields[key]!))) return null;
  const model: unknown = fields["model"]?.value, effort: unknown = fields["effort"]?.value;
  if (!((model === undefined || model === null || (typeof model === "string" && model.length > 0)) && (effort === undefined || effort === null || ["low", "medium", "high", "xhigh", "max"].includes(effort as string)))) return null;
  return { model: typeof model === "string" ? model : null, effort: typeof effort === "string" ? effort as NativeTier["effort"] : null };
}
const projectionSchema = z.unknown().transform((value, context): NativeTier => {
  const snapshot = rawTierProjection(value);
  if (snapshot !== null) return snapshot;
  context.addIssue({ code: "custom", message: "tier projection requires plain model/effort data" });
  return z.NEVER;
});
const missingFileSchema = z.object({ code: z.enum(["ENOENT", "ENOTDIR"]) });
const evaluationSchema = z.strictObject({ memoryCap: tierSchema, tiers: z.strictObject({ judgment: projectionSchema, balanced: projectionSchema, templated: projectionSchema }) });
type PolicyExpectation = { readonly path: string; readonly sha256: string | null };
export type CoreAgentPolicyEvaluation = { readonly sourceRoot: string; readonly harness: QualifiedHarnessProfile["harness"]; readonly environmentCap: Tier | null; readonly expected: readonly PolicyExpectation[] };
type PolicyObservation = { readonly path: string; readonly bytes: Uint8Array | null };
type NativePolicyProjection = { readonly cap: Tier | null; readonly tiers: PreparedCoreAgentPolicy["models"]["tiers"] };
export type CoreAgentPolicyLocation = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly binding: HarnessBinding; readonly environmentCap?: Tier | null };
export type CoreAgentPolicySourceOperations = {
  readonly read: (input: { readonly sourceRoot: string; readonly path: string }) => Promise<Outcome<Uint8Array | null>>;
  readonly project: (input: CoreAgentPolicyEvaluation) => Promise<Outcome<unknown>>;
  readonly digest: (input: { readonly bytes: Uint8Array }) => string;
};
export type CoreAgentPolicyReader = { readonly load: (input: CoreAgentPolicyLocation) => Promise<Outcome<PreparedCoreAgentPolicy>> };

const unavailablePolicy = ({ detail }: { readonly detail: string }): Outcome<never> => ({ status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-agent-policy", detail })] });
const readPolicySource = async ({ sourceRoot, path }: { readonly sourceRoot: string; readonly path: string }): Promise<Outcome<Uint8Array | null>> => {
  try { ordinaryPolicyPath(sourceRoot, true); ordinaryPolicyPath(join(sourceRoot, path), false); return { status: "ok", value: await Bun.file(`${sourceRoot}/${path}`).bytes() }; }
  catch (error) { return missingFileSchema.safeParse(error).success ? { status: "ok", value: null } : unavailablePolicy({ detail: `agent policy source unavailable: ${path}` }); }
};
function ordinaryPolicyPath(path: string, directory: boolean): void {
  if (!isAbsolute(path)) throw new Error("Tier policy requires explicit absolute source and working paths");
  const absolute = resolve(path);
  const stat = lstatSync(absolute);
  const same = process.platform === "win32" ? realpathSync(absolute).toLowerCase() === absolute.toLowerCase() : realpathSync(absolute) === absolute;
  if (!same || stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error("Tier policy requires ordinary source and working paths");
}
const policyProgram = `
const rawTierProjection = ${rawTierProjection.toString()};
const request = await Bun.stdin.json();
const observe = async () => {
  for (const expected of request.expected) {
    const file = Bun.file(request.sourceRoot + "/" + expected.path);
    const actual = await file.exists() ? new Bun.CryptoHasher("sha256").update(await file.bytes()).digest("hex") : null;
    if (actual !== expected.sha256) throw new Error("Tier policy source changed during isolated evaluation: " + expected.path);
  }
};
await observe();
const path = request.sourceRoot + "/${modulePath}";
const text = await Bun.file(path).text();
const { isBuiltin } = await import("node:module");
for (const dependency of new Bun.Transpiler({ loader: "ts" }).scanImports(text)) {
  if (!dependency.path.startsWith("node:") || !isBuiltin(dependency.path)) throw new Error("Tier policy does not admit unwitnessed source dependencies: " + dependency.path);
}
const api = await import(Bun.pathToFileURL(path).href);
if (typeof api.readMemoryCap !== "function" || typeof api.projectTier !== "function") throw new Error("Tier policy requires readMemoryCap and projectTier capabilities");
const memoryCap = api.readMemoryCap(request.sourceRoot + "/core/memory");
if (memoryCap !== null && !["judgment", "balanced", "templated"].includes(memoryCap)) throw new Error("Tier policy memory cap is invalid");
const cap = request.environmentCap ?? memoryCap;
const tiers = Object.fromEntries(["judgment", "balanced", "templated"].map(tier => {
  const projected = rawTierProjection(api.projectTier(tier, request.harness, cap));
  if (projected === null) throw new Error("Tier policy must return a plain model/effort projection before serialization");
  return [tier, projected];
}));
await observe();
process.stdout.write(JSON.stringify({ memoryCap, tiers }));
`;
export type CoreAgentPolicyProcessOptions = { readonly workRoot: string; readonly binary?: string; readonly operations?: NativeCompilerProcessOperations };
const evaluatePolicySource = async (request: CoreAgentPolicyEvaluation, { workRoot, binary = process.execPath, operations = createNativeCompilerProcessOperations() }: CoreAgentPolicyProcessOptions): Promise<Outcome<unknown>> => {
  let owned: string | undefined;
  try {
    ordinaryPolicyPath(request.sourceRoot, true); ordinaryPolicyPath(workRoot, true);
    const source = resolve(request.sourceRoot).toLowerCase(), scratch = resolve(workRoot).toLowerCase();
    if (source === scratch || source.startsWith(scratch + sep) || scratch.startsWith(source + sep)) throw new Error("Tier policy requires a separate working root outside authored source");
    owned = mkdtempSync(join(resolve(workRoot), "tier-policy-"));
    const reply = operations.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", policyProgram], cwd: owned, input: JSON.stringify(request), env: { ...privateCompilerEnvironment({ inherited: operations.environment(), root: owned }), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", BUN_INSTALL_AUTO: "disable" } });
    if (reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0) throw new Error(reply.error || reply.stderr || "Tier policy process failed");
    return { status: "ok", value: JSON.parse(reply.stdout) };
  } catch (error) { return unavailablePolicy({ detail: error instanceof Error ? error.message : "native tier policy could not be evaluated" }); }
  finally { if (owned !== undefined) rmSync(owned, { recursive: true, force: true }); }
};
export const createCoreAgentPolicySourceOperations = (options: CoreAgentPolicyProcessOptions): CoreAgentPolicySourceOperations => ({
  read: readPolicySource,
  project: request => evaluatePolicySource(request, options),
  digest: createOwnershipDigest(),
});

const admitPolicyLocation = ({ location }: { readonly location: CoreAgentPolicyLocation }): Outcome<CoreAgentPolicyLocation> => {
  if (!tierSchema.safeParse(location.environmentCap ?? null).success) return { status: "invalid", findings: [finding({ code: "invalid-tier-mapping", subject: "core-agent-policy", detail: "the explicit environment cap must be a supported tier or null" })] };
  if (location.basis.source.kind !== "core" || location.basis.source.id !== "framework" || location.basis.pin.trim().length === 0) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-agent-policy", detail: "declare the framework source basis before preparing core agent model policy" })] };
  if (qualifiedHarnessProfile(location.binding) === null) return { status: "invalid", findings: [finding({ code: "inapplicable-agent-context", subject: "core-agent-policy", detail: "the qualified core agent policy profile requires a qualified host binding" })] };
  return { status: "ok", value: location };
};
const observePolicySources = async ({ location, source }: { readonly location: CoreAgentPolicyLocation; readonly source: CoreAgentPolicySourceOperations }): Promise<Outcome<readonly PolicyObservation[]>> => {
  const reads = await Promise.all(paths.map(async (path) => ({ path, observed: await source.read({ sourceRoot: location.sourceRoot, path }) })));
  const findings = reads.flatMap(({ observed }) => observed.status === "invalid" ? observed.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: reads.flatMap(({ path, observed }) => observed.status === "ok" ? [{ path, bytes: observed.value }] : []) };
};
const policyWitnesses = ({ observations, source }: { readonly observations: readonly PolicyObservation[]; readonly source: CoreAgentPolicySourceOperations }): readonly SourceContentDigest[] => observations.flatMap(({ path, bytes }) => bytes === null ? [] : [{ path, sha256: source.digest({ bytes }) }]);
const admitNativePolicy = ({ evaluated, location }: { readonly evaluated: unknown; readonly location: CoreAgentPolicyLocation }): Outcome<NativePolicyProjection> => {
  const admitted = evaluationSchema.safeParse(evaluated);
  if (!admitted.success) return { status: "invalid", findings: [finding({ code: "invalid-tier-mapping", subject: modulePath, detail: "native tier evaluation requires a supported memory cap and complete typed model/effort projections" })] };
  const tiers = admitted.data.tiers;
  const normalize = (tier: keyof typeof tiers): NativeTier => ({ model: tiers[tier].model ?? null, effort: tiers[tier].effort ?? null });
  return { status: "ok", value: { cap: location.environmentCap ?? admitted.data.memoryCap, tiers: { judgment: normalize("judgment"), balanced: normalize("balanced"), templated: normalize("templated") } } };
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
  const profile = qualifiedHarnessProfile(location.binding)!;
  const evaluated = await source.project({ sourceRoot: location.sourceRoot, harness: profile.tierFlavor ?? profile.harness, environmentCap: location.environmentCap ?? null, expected: before.map(({ path, bytes }) => ({ path, sha256: bytes === null ? null : source.digest({ bytes }) })) });
  if (evaluated.status === "invalid") return evaluated;
  const projected = admitNativePolicy({ evaluated: evaluated.value, location });
  return continuePreparation({ previous: projected, consume: ({ prepared }) => continuePreparation({ previous: observePolicySources({ location, source }), consume: ({ prepared: after }) => finishPolicyObservation({ before, after, projection: prepared, inputs, location }) }) });
};
const readCoreAgentPolicy = async ({ location, source }: { readonly location: CoreAgentPolicyLocation; readonly source: CoreAgentPolicySourceOperations }): Promise<Outcome<PreparedCoreAgentPolicy>> => {
  try { return await continuePreparation({ previous: observePolicySources({ location, source }), consume: ({ prepared: before }) => prepareObservedPolicy({ before, location, source }) }); }
  catch { return unavailablePolicy({ detail: "agent policy source or native capability unavailable during preparation" }); }
};
export const createCoreAgentPolicyReader = (options: { readonly source: CoreAgentPolicySourceOperations } | CoreAgentPolicyProcessOptions): CoreAgentPolicyReader => {
  const source = "source" in options ? options.source : createCoreAgentPolicySourceOperations(options);
  return { load: location => continuePreparation({ previous: admitPolicyLocation({ location }), consume: ({ prepared }) => readCoreAgentPolicy({ location: prepared, source }) }) };
};
