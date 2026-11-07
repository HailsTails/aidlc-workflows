import { types } from "node:util";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { deserialize } from "node:v8";
import { z } from "zod";
import { createHash } from "node:crypto";
import { createDistributionAssembler } from "../application/distribution-assembly.ts";
import { packageInputsFingerprint } from "../../../package-sources.ts";
import { harnessBindingSchema } from "./harness-binding-schema.ts";
import { qualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { createProjectionOwnershipCodec, createOwnershipDigest } from "./projection-ownership.ts";
import { prepareProjectedProducts } from "../application/projected-products.ts";
import { issueCoreProjectionOwnership } from "../domain/projection-ownership.ts";
import { prepareDistributionStructure } from "../domain/distribution-structure.ts";
import { pathStatus } from "../domain/model.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment } from "./native-compiler-process.ts";
import { observeOpenCodeInputs } from "./opencode-source-contract.ts";
import { ordinarySourcePath, observeProductionInputs, verifyProductionInputs } from "./source-input-contract.ts";
import type { ClaudeCopyRequest } from "../../../projection-process.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { IssuedProjectionDistribution } from "../../examples/projection-distribution.ts";

// A new module realm is essential: Bun query-string imports retain same-path modules.
// Binary transport retains byte arrays without rewriting issued files or ownership.
const program = `
const request = await Bun.stdin.json();
const { serialize } = await import("node:v8");
const { writeFileSync } = await import("node:fs");
const transport = await import(Bun.pathToFileURL(request.sourceRoot + "/scripts/projection/src/adapters/fresh-core-assembly.ts").href);
const api = await import(Bun.pathToFileURL(request.sourceRoot + "/scripts/project-core.ts").href);
const artifacts = [];
for (const step of request.steps) {
  if (step.binding.harness === "opencode") {
    const { observeOpenCodeInputs } = await import(Bun.pathToFileURL(request.sourceRoot + "/scripts/projection/src/adapters/opencode-source-contract.ts").href);
    observeOpenCodeInputs(request.sourceRoot);
    const { manifestEmitter } = await import(Bun.pathToFileURL(request.sourceRoot + "/scripts/projection/src/adapters/manifest-capabilities.ts").href);
    manifestEmitter((await import(Bun.pathToFileURL(request.sourceRoot + "/harness/opencode/manifest.ts").href)).default);
  }
  artifacts.push(step.delivery === "copy" ? [await api.assembleSourceCore(request.profile, step.binding, "copy")] : await api.assembleSourceCorePair(request.profile, step.binding));
}
writeFileSync(request.output, serialize(transport.materializeArtifactData(artifacts)));
`;
const safePath = z.string().refine(path => pathStatus({ path }) === "safe");
const mode = z.number().int().min(0).max(0o777);
const sourceBasis = z.strictObject({ source: z.strictObject({ kind: z.literal("core"), id: z.literal("framework") }), pin: z.string().regex(/^[a-f0-9]{40}$/) });
const artifactSchema = z.strictObject({
  sourceDiagnostics: z.strictObject({ stdout: z.string(), stderr: z.string() }).optional(),
  archive: z.instanceof(Uint8Array), ownershipJson: z.string(), evaluation: z.strictObject({ buildVersion: z.string(), environmentCap: z.enum(["judgment", "balanced", "templated"]).nullable(), delivery: z.enum(["copy", "native"]) }),
  sourceInputs: z.array(z.strictObject({ path: safePath, sha256: z.string().regex(/^[a-f0-9]{64}$/) })), inputPreparations: z.array(z.unknown()).optional(),
  preparedProducts: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9-]*$/), owner: sourceBasis, binding: harnessBindingSchema, inputs: z.array(sourceBasis.extend({ path: safePath })).min(1), requiredByProducer: z.array(safePath), files: z.array(z.strictObject({ path: safePath, bytes: z.instanceof(Uint8Array), mode })).min(1) })).optional(),
  distribution: z.strictObject({ seed: sourceBasis, binding: harnessBindingSchema, structure: z.strictObject({ kind: z.enum(["file-parents", "prepared-root"]), mode }).optional(), files: z.array(z.strictObject({ path: safePath, bytes: z.instanceof(Uint8Array), mode })).min(1), directories: z.array(z.strictObject({ path: safePath, mode })), replaced: z.array(safePath), retained: z.array(safePath) }),
  projection: z.strictObject({ scope: z.literal("selected-surfaces"), target: harnessBindingSchema, resources: z.array(z.strictObject({ kind: z.literal("file"), path: safePath, body: z.string() })), units: z.array(z.strictObject({ kind: z.enum(["sensor", "harness-document", "guidance", "knowledge", "stage", "scope", "agent", "compiled-agent", "skill", "runners"]), key: z.string(), projection: z.unknown() })) }),
});
// Capture trusted operations before selected-source policy is evaluated.
const isProxy = types.isProxy, isByteArray = types.isUint8Array, prototypeOf = Object.getPrototypeOf, descriptors = Object.getOwnPropertyDescriptors, symbols = Object.getOwnPropertySymbols;
const ByteArray = Uint8Array, bytePrototype = Uint8Array.prototype, bufferPrototype = Buffer.prototype, arrayPrototype = Array.prototype;
const typedPrototype = prototypeOf(bytePrototype), lengthGetter = Object.getOwnPropertyDescriptor(typedPrototype, "length")!.get!, bufferGetter = Object.getOwnPropertyDescriptor(typedPrototype, "buffer")!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!, setBytes = bytePrototype.set, apply = Reflect.apply;
const isArray = Array.isArray, finite = Number.isFinite, keys = Object.keys, entries = Object.entries, define = Object.defineProperty, create = Object.create;
export function materializeArtifactData(input: unknown): unknown {
  const active = new Set<object>(), completed = new WeakMap<object, unknown>();
  const visit = (value: unknown): unknown => {
    if (value === undefined || value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && finite(value)) return value;
    if (typeof value !== "object" || isProxy(value)) throw new Error("Artifact transport requires ordinary data and rejects proxies");
    if (active.has(value)) throw new Error("Artifact transport rejects cycles");
    if (completed.has(value)) return completed.get(value);
    const prototype = prototypeOf(value);
    if (prototype === bytePrototype || prototype === bufferPrototype) {
      if (!isByteArray(value)) throw new Error("Artifact binary views require genuine Uint8Array storage");
      // Binary views are opaque: copy internal bytes without reading expandos,
      // iterators, species, toJSON or shadowed length/buffer/offset properties.
      const length = z.number().int().nonnegative().parse(apply(lengthGetter, value, [])), buffer: unknown = apply(bufferGetter, value, []);
      apply(bufferLengthGetter, buffer, []); // Reject shared backing storage.
      const snapshot = new ByteArray(length);
      apply(setBytes, snapshot, [value]); // Detached storage refuses here.
      completed.set(value, snapshot);
      return snapshot;
    }
    if (symbols(value).length !== 0) throw new Error("Artifact transport rejects symbol fields");
    const array = isArray(value);
    if (array ? prototype !== arrayPrototype : prototype !== Object.prototype && prototype !== null) throw new Error("Artifact transport rejects non-data prototypes");
    const fields = descriptors(value), length = array ? z.number().int().nonnegative().parse(fields["length"]!.value) : 0;
    if (array && (keys(fields).length !== length + 1 || keys(fields).some(key => key !== "length" && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)))) throw new Error("Artifact arrays must be dense indexed data");
    const snapshot: object = array ? [] : create(prototype);
    active.add(value);
    for (const [key, field] of entries(fields)) {
      if (!("value" in field) || !field.enumerable && !(array && key === "length")) throw new Error("Artifact transport rejects accessors and hidden fields");
      if (array && key === "length") continue;
      define(snapshot, key, { value: visit(field.value), enumerable: true, writable: true, configurable: true });
    }
    active.delete(value); completed.set(value, snapshot);
    return snapshot;
  };
  return visit(input);
}
export function ordinaryArtifactData(value: unknown): void { materializeArtifactData(value); }
export function admitIssuedCoreArtifact(candidate: unknown, binding: HarnessBinding, pin: string, archivePath: string, evaluation: NonNullable<IssuedProjectionDistribution["evaluation"]>): IssuedProjectionDistribution {
  candidate = materializeArtifactData(candidate);
  artifactSchema.parse(candidate);
  const artifact = candidate as IssuedProjectionDistribution, distribution = artifact.distribution;
  if (JSON.stringify(artifact.evaluation) !== JSON.stringify(evaluation)) throw new Error("Artifact evaluation must match the requested version, cap and delivery");
  const sameBinding = (actual: HarnessBinding) => actual.harness === binding.harness && actual.directory === binding.directory;
  if (!sameBinding(distribution.binding) || !sameBinding(artifact.projection.target) || distribution.seed.pin !== pin) throw new Error("Artifact transport requires the requested binding and source pin");
  const structure = prepareDistributionStructure({ files: distribution.files, retained: distribution.directories, mode: distribution.structure?.mode ?? 0o755, rules: { path: pathStatus }, preserveExplicit: distribution.structure?.kind === "prepared-root" });
  if (structure.status === "invalid" || JSON.stringify(structure.value) !== JSON.stringify(distribution.directories)) throw new Error("Artifact transport requires exact file-parent structure");
  const stampFile = distribution.files.find(file => file.path === binding.directory + "/tools/data/aidlc-stamp.json");
  const stamp = stampFile === undefined ? null : JSON.parse(new TextDecoder().decode(stampFile.bytes));
  if (stamp?.frameworkVersion !== evaluation.buildVersion || stamp?.distribution !== binding.harness || stamp?.harnessDir !== binding.directory) throw new Error("Artifact stamp must match the selected version and host");
  const invocation = evaluation.delivery === "native" ? "aidlc" : "bun " + binding.directory + "/tools/aidlc.ts";
  const runtime = distribution.files.find(file => file.path === binding.directory + "/tools/aidlc-runtime-paths.ts");
  if (runtime === undefined || !new TextDecoder().decode(runtime.bytes).includes('const PROJECTED_INVOKE = ' + JSON.stringify(invocation) + ';')) throw new Error("Artifact runtime must match the selected delivery");
  const assembled = createDistributionAssembler({ rules: { path: pathStatus, encode: ({ text }) => new TextEncoder().encode(text) } }).assemble({ seed: { ...distribution, basis: distribution.seed, rulesSubdir: "rules", invocation }, projection: artifact.projection, ...(artifact.preparedProducts === undefined ? {} : { preparedProducts: artifact.preparedProducts }) });
  const preparedPaths = artifact.preparedProducts?.flatMap(product => product.files.map(file => file.path)) ?? [];
  if (assembled.status === "invalid" || JSON.stringify([...assembled.value.replaced, ...preparedPaths]) !== JSON.stringify(distribution.replaced) || JSON.stringify(assembled.value.retained.filter(path => !preparedPaths.includes(path))) !== JSON.stringify(distribution.retained) || assembled.value.files.some((file, index) => !Buffer.from(file.bytes).equals(Buffer.from(distribution.files[index]!.bytes)))) throw new Error("Artifact projection, replacements and retained files must agree with assembled bytes");
  const products = prepareProjectedProducts({ projection: artifact.projection, sources: [distribution.seed], compiler: distribution.seed, mode: artifact.projection.resources.length === 0 ? 0 : distribution.files.find(file => artifact.projection.resources.some(resource => resource.path === file.path))?.mode ?? -1, rules: { encode: ({ text }) => new TextEncoder().encode(text) } });
  if (products.status === "invalid") throw new Error("Artifact transport requires valid projected products");
  const projectedFiles = products.value.flatMap(product => product.files);
  if (projectedFiles.length !== artifact.projection.resources.length || artifact.projection.resources.some(resource => projectedFiles.filter(file => file.path === resource.path && Buffer.from(file.bytes).equals(Buffer.from(resource.body))).length !== 1)) throw new Error("Artifact units must cover exactly the top-level projection resources");
  const hostPreparations = artifact.inputPreparations?.filter(preparation => preparation.kind === "host-emission") ?? [];
  if (artifact.preparedProducts !== undefined && (hostPreparations.length !== 1 || artifact.preparedProducts.some(product => product.key !== "manifest-emission" || product.inputs.filter(origin => origin.path === `harness/${binding.harness}/manifest.ts`).length !== 1 || new Set(product.inputs.map(origin => origin.path)).size !== product.inputs.length || product.inputs.some(origin => !artifact.sourceInputs?.some(input => input.path === origin.path)) || product.requiredByProducer.length !== 0) || JSON.stringify([...hostPreparations[0]!.paths].sort()) !== JSON.stringify([...preparedPaths].sort()))) throw new Error("Prepared host ownership requires the exact witnessed manifest amendment footprint");
  const ownership = issueCoreProjectionOwnership({ distribution, products: products.value, ...(artifact.preparedProducts === undefined ? {} : { preparedProducts: artifact.preparedProducts }), digest: createOwnershipDigest() });
  const codec = createProjectionOwnershipCodec(), decoded = codec.read({ json: artifact.ownershipJson });
  if (ownership.status === "invalid" || decoded.status === "invalid" || codec.write({ ownership: ownership.value }) !== artifact.ownershipJson) throw new Error("Artifact ownership must agree with exact final projected bytes");
  writeFileSync(archivePath, artifact.archive);
  // The validator uses its existing native archive port, not code from the selected source root.
  const archiveApi: unknown = require("../../../../core/tools/aidlc-archive.ts");
  const reader = z.object({ readTarGz: z.function({ input: [z.string()], output: z.array(z.strictObject({ path: safePath, type: z.enum(["file", "directory"]), mode, data: z.instanceof(Uint8Array) })) }) }).parse(archiveApi);
  const entries = reader.readTarGz(archivePath);
  if (entries.length !== distribution.files.length + distribution.directories.length || entries.some(entry => {
    if (entry.type === "directory") return distribution.directories.filter(directory => directory.path === entry.path && directory.mode === entry.mode).length !== 1;
    return distribution.files.filter(file => file.path === entry.path && file.mode === entry.mode && Buffer.from(file.bytes).equals(entry.data)).length !== 1;
  })) throw new Error("Artifact archive must contain exactly its declared final files, directories and modes");
  return artifact;
}
export type FreshCoreEvaluationStep = { readonly binding: HarnessBinding; readonly delivery: "copy" | "native" | "paired" };
// One finite source realm per public request. Ordered steps retain authored
// callback/module state within that request; no session survives this call.
export async function assembleFreshCoreSession({ request, steps, workRoot }: { readonly request: ClaudeCopyRequest; readonly steps: readonly FreshCoreEvaluationStep[]; readonly workRoot: string }): Promise<readonly (readonly IssuedProjectionDistribution[])[]> {
  z.strictObject({ sourceRoot: z.string().min(1), outRoot: z.string().min(1), buildVersion: z.string().min(1), environmentCap: z.enum(["judgment", "balanced", "templated"]).nullable() }).parse(request);
  const plan = z.array(z.strictObject({ binding: harnessBindingSchema, delivery: z.enum(["copy", "native", "paired"]) })).min(1).max(64).parse(steps);
  if (plan.some(step => qualifiedHarnessProfile(step.binding) === null)) throw new Error("Fresh assembly requires qualified bindings and explicit delivery");
  ordinarySourcePath(request.sourceRoot, true); ordinarySourcePath(workRoot, true);
  const source = resolve(request.sourceRoot).toLowerCase(), work = resolve(workRoot).toLowerCase();
  if (source === work || source.startsWith(work + sep) || work.startsWith(source + sep)) throw new Error("Fresh assembly requires an explicit separate working root");
  const expected = observeProductionInputs(request.sourceRoot);
  if (plan.some(step => step.binding.harness === "opencode")) observeOpenCodeInputs(request.sourceRoot);
  const pin = createHash("sha1").update(packageInputsFingerprint(request.sourceRoot)).digest("hex");
  const owned = mkdtempSync(join(workRoot, "fresh-core-")), output = join(owned, "artifacts.bin");
  try {
    const operations = createNativeCompilerProcessOperations({ timeout: 180000 * plan.length, maxBuffer: 8 * 1024 * 1024 });
    const reply = operations.spawn({ binary: process.execPath, args: ["--no-env-file", "--no-install", "--eval", program], cwd: owned, input: JSON.stringify({ sourceRoot: request.sourceRoot, profile: request, steps: plan, output }), env: { ...privateCompilerEnvironment({ inherited: operations.environment(), root: owned }), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", BUN_INSTALL_AUTO: "disable" } });
    if (reply.exitCode !== 0 || reply.error !== null) throw new Error(reply.stderr || reply.error || "Fresh assembly process failed");
    ordinarySourcePath(output, false);
    const groups = z.array(z.array(z.unknown())).length(plan.length).parse(materializeArtifactData(deserialize(readFileSync(output))));
    const admitted = groups.map((values, stepIndex) => {
      const step = plan[stepIndex]!;
      if (values.length !== (step.delivery === "copy" ? 1 : 2)) throw new Error("Source session must return exactly the ordered requested channels");
      const artifacts = values.map((value, channelIndex) => admitIssuedCoreArtifact(value, step.binding, pin, join(owned, "artifact-" + stepIndex + "-" + channelIndex + ".tar.gz"), { buildVersion: request.buildVersion, environmentCap: request.environmentCap, delivery: channelIndex === 0 ? "copy" : "native" }));
      for (const artifact of artifacts) verifyProductionInputs(expected, artifact.sourceInputs ?? []);
      if (artifacts.length === 2) verifyIssuedCorePair(artifacts[0]!, artifacts[1]!, JSON.parse(readFileSync(join(request.sourceRoot, "scripts/copy-era-files.json"), "utf8"))[step.binding.harness]);
      return artifacts.map(artifact => ({ ...artifact, sourceDiagnostics: { stdout: reply.stdout, stderr: reply.stderr } }));
    });
    verifyProductionInputs(expected, observeProductionInputs(request.sourceRoot));
    return admitted;
  } finally { rmSync(owned, { recursive: true, force: true }); }
}
export async function assembleFreshCore(input: { readonly request: ClaudeCopyRequest; readonly binding: HarnessBinding; readonly delivery: "copy" | "native"; readonly workRoot: string }): Promise<IssuedProjectionDistribution> {
  const groups = await assembleFreshCoreSession({ request: input.request, steps: [{ binding: harnessBindingSchema.parse({ harness: input.binding.harness, directory: input.binding.directory }), delivery: input.delivery }], workRoot: input.workRoot });
  return groups[0]![input.delivery === "copy" ? 0 : 1]!;
}
export async function assembleFreshCorePair(input: { readonly request: ClaudeCopyRequest; readonly binding: HarnessBinding; readonly workRoot: string }): Promise<readonly [IssuedProjectionDistribution, IssuedProjectionDistribution]> {
  const groups = await assembleFreshCoreSession({ request: input.request, steps: [{ binding: harnessBindingSchema.parse({ harness: input.binding.harness, directory: input.binding.directory }), delivery: "paired" }], workRoot: input.workRoot });
  return [groups[0]![0]!, groups[0]![1]!];
}
export function verifyIssuedCorePair(copy: IssuedProjectionDistribution, native: IssuedProjectionDistribution, history: unknown): void {
  if (copy.evaluation?.delivery !== "copy" || native.evaluation?.delivery !== "native" || copy.evaluation.buildVersion !== native.evaluation.buildVersion || copy.evaluation.environmentCap !== native.evaluation.environmentCap || JSON.stringify(copy.distribution.seed) !== JSON.stringify(native.distribution.seed) || JSON.stringify(copy.distribution.binding) !== JSON.stringify(native.distribution.binding)) throw new Error("Paired artifacts require the same source, binding, version and cap");
  const harnessDir = native.distribution.binding.directory;
  const descriptor = native.distribution.files.find(file => file.path === `${harnessDir}/tools/data/aidlc-projection.json`);
  if (descriptor === undefined) throw new Error("Paired native artifact requires its descriptor");
  const actual = JSON.parse(new TextDecoder().decode(descriptor.bytes));
  const historyMap = z.record(safePath, z.array(z.string().regex(/^sha256:[a-f0-9]{64}$/)));
  const historyPort = z.object({ prepareNativeHistory: z.function({ input: [z.strictObject({ nativeFiles: z.array(z.object({ path: safePath, bytes: z.instanceof(Uint8Array) })), copyFiles: z.array(z.strictObject({ path: safePath, sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/) })), history: z.unknown(), harnessDir: safePath, managedDirectories: z.array(safePath) })], output: z.union([z.strictObject({ kind: z.literal("prepared"), retiredCopyFileHashes: historyMap, legacyManagedFileHashes: historyMap }), z.strictObject({ kind: z.literal("refused"), message: z.string() })]) }) }).parse(require("../../native/native-delivery.ts"));
  const expected = historyPort.prepareNativeHistory({ nativeFiles: native.distribution.files.map(file => ({ path: file.path, bytes: Uint8Array.from(file.bytes) })), copyFiles: copy.distribution.files.map(file => ({ path: file.path, sha256: `sha256:${createHash("sha256").update(file.bytes).digest("hex")}` })), history, harnessDir, managedDirectories: actual.managedDirectories });
  const canonicalHistory = (value: unknown) => JSON.stringify(Object.entries(historyMap.parse(value)).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  if (expected.kind === "refused" || canonicalHistory(expected.legacyManagedFileHashes) !== canonicalHistory(actual.legacyManagedFileHashes) || canonicalHistory(expected.retiredCopyFileHashes) !== canonicalHistory(actual.retiredCopyFileHashes)) throw new Error("Native migration history must describe the actual paired copy artifact");
}
