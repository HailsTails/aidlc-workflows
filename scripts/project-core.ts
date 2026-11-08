import { removeDistributionDirectory, type DistributionDirectoryFactory } from "./projection/src/adapters/distribution-directory.ts";
import { createChildRuntimeProcessFactory } from "./projection/src/adapters/child-runtime-process.ts";
import type { NativeCompilerProcessFactory } from "./projection/src/adapters/native-compiler-process.ts";
import { createWorkflowDistributionServices, createPreparedRuntimeAssembler } from "./projection/examples/workflow-distribution.ts";
import { createSourceContractDistributionSource } from "./projection/examples/source-contract-distribution.ts";
import { createSourceRuntimeContractPreparer } from "./projection/src/adapters/source-runtime-contracts.ts";
import { createPluginAuthoringDistributionSource } from "./projection/examples/plugin-authoring-distribution.ts";
import { createSourcePluginAuthoringPreparer } from "./projection/src/adapters/source-plugin-authoring.ts";
import type { ChildRuntimeDirectories } from "./projection/src/adapters/child-runtime-directory.ts";
import { mergeSourceDigests } from "./projection/src/domain/source-origin.ts";
import { createSourceHostEmissionPreparer, sourceHostEmissionSelected } from "./projection/src/adapters/source-host-emission.ts";
import { assembleFreshCore, assembleFreshCorePair, assembleFreshCoreSession } from "./projection/src/adapters/fresh-core-assembly.ts";
import { ordinarySourcePath, observeProductionInputs, verifyProductionInputs } from "./projection/src/adapters/source-input-contract.ts";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { z } from "zod";
import { assembleAuthoredCoreDistribution } from "./projection/examples/core-distribution.ts";
import { createDescribedCoreDistributionServices, createCoreDescriptionServices } from "./projection/examples/described-core-distribution.ts";
import { createPublicationAssembler } from "./projection/examples/publication-assembly.ts";
import { packageInputsFingerprint } from "./package-sources.ts";
import { projectionModes, type ClaudeCopyProfile, type ClaudeCopyRequest } from "./projection-process.ts";
import { createCoreDocumentDistributionServices } from "./projection/examples/core-document-distribution.ts";
import { createCoreDocumentServices, prepareCoreAuthoredDocuments } from "./projection/examples/core-authored-documents.ts";
import { createCoreAgentPolicyReader } from "./projection/src/adapters/core-agent-policy.ts";
import { createSourceRuntimeModulePreparer } from "./projection/src/adapters/source-runtime-modules.ts";
import { createSourceDescriptionPreparer } from "./projection/src/adapters/source-distribution-description.ts";
import { createSourceModuleDistributionSource } from "./projection/examples/source-module-distribution.ts";

import type { HarnessBinding } from "./projection/src/domain/harness-binding.ts";
import { harnessBindingSchema } from "./projection/src/adapters/harness-binding-schema.ts";
import { qualifiedHarnessProfile, qualifiedHarnessByName } from "./projection/src/adapters/qualified-harness-profile.ts";
import { createOnboardingPreparer, type OnboardingPreparer } from "./projection/src/adapters/onboarding-source.ts";
import { createOnboardingProductServices, prepareOnboardingProducts } from "./projection/examples/onboarding-products.ts";
import { createHarnessSettingsDistributionSource } from "./projection/examples/harness-settings-distribution.ts";
import type { PairedCopyDescription } from "./projection/src/domain/distribution-description.ts";
import type { IssuedProjectionDistribution } from "./projection/examples/projection-distribution.ts";
import { createSourceContextDistributionSource } from "./projection/examples/source-context-distribution.ts";
import { createSourceRuntimeContextReader } from "./projection/src/adapters/source-runtime-context.ts";

function createCoreServices({ buildVersion, environmentCap, workRoot, processes, directories }: ClaudeCopyProfile & { readonly workRoot: string; readonly processes: NativeCompilerProcessFactory; readonly directories: DistributionDirectoryFactory }, onboarding: OnboardingPreparer, copy?: PairedCopyDescription) {
  return createDescribedCoreDistributionServices({
    workflow: () => createWorkflowDistributionServices({ processes, directories }),
    core: () => {
      const documents = createCoreDocumentServices(workRoot, { processes, directories });
      const policy = createCoreAgentPolicyReader({ workRoot, processes, directories });
      return { ...createCoreDocumentDistributionServices({ directories }), assembler: options => createPreparedRuntimeAssembler({ ...options, processes, directories }), host: createSourceHostEmissionPreparer({ environmentCap, buildVersion, processes, directories }), documents: request => prepareCoreAuthoredDocuments({ ...request, services: { ...documents, policy: { load: location => policy.load({ ...location, environmentCap }) }, onboarding: request => prepareOnboardingProducts({ ...request, services: { ...createOnboardingProductServices(), preparation: onboarding } }) } }) };
    },
    description: ({ rules }) => createCoreDescriptionServices({ rules, preparation: () => createSourceDescriptionPreparer({ buildVersion, processes, ...(copy === undefined ? {} : { nativePair: { profile: { buildVersion, environmentCap }, copy } }) }) }),
  });
}

export const copyRequestSchema = z.strictObject({ sourceRoot: z.string().min(1), outRoot: z.string().min(1), buildVersion: z.string().min(1), environmentCap: z.enum(["judgment", "balanced", "templated"]).nullable() });

async function assembleCore(request: ClaudeCopyRequest, binding: HarnessBinding, { runtimeDirectories, directories }: { readonly runtimeDirectories: ChildRuntimeDirectories; readonly directories: DistributionDirectoryFactory }, copy?: PairedCopyDescription): Promise<IssuedProjectionDistribution> {
  const { sourceRoot, buildVersion, environmentCap } = copyRequestSchema.parse(request);
  const productionInputs = observeProductionInputs(sourceRoot);
  const beforeHost = await sourceHostEmissionSelected(sourceRoot, binding);
  const workspaceDirectories = directories();
  const workspace = workspaceDirectories.allocate();
  try {
  ordinarySourcePath(workspace, true);
  const owned = process.platform === "win32" ? resolve(workspace).toLowerCase() : resolve(workspace);
  const authored = process.platform === "win32" ? resolve(sourceRoot).toLowerCase() : resolve(sourceRoot);
  if (owned === authored || owned.startsWith(authored + sep) || authored.startsWith(owned + sep)) throw new Error("Projection workspace requires a separate owned root outside authored source");
  const runtimeRoot = join(workspace, "input");
  mkdirSync(runtimeRoot);
  const { fileMode: mode, directoryMode } = projectionModes({ platform: process.platform, umask: process.umask() });
  const pin = createHash("sha1").update(packageInputsFingerprint(sourceRoot)).digest("hex");
  const preparation = {
    runtimeContext: "prepare-source", runtimeAssets: "prepare-authored", runtimeContracts: "prepare-source",
    runtimeModules: "prepare-source", pluginAuthoring: "prepare-source", harnessSettings: "prepare-source", workspaceSeed: "prepare-source",
    directories: { kind: "file-parents", mode: directoryMode }, mode,
  } as const;
  const profile = qualifiedHarnessProfile(binding);
  if (profile === null) throw new Error("Host projection profile is not qualified");
  const processes = createChildRuntimeProcessFactory({ runtimeDirectories });
  const prepareOnboarding = createOnboardingPreparer({ processes });
  const onboardingCache = new Map<string, ReturnType<OnboardingPreparer["prepare"]>>();
  const onboarding: OnboardingPreparer = { prepare: request => {
    const { sourceRoot, basis, context } = request;
    const key = JSON.stringify({ sourceRoot, basis, harness: context.harness, directory: context.directory, invocation: context.invocation, rulesSubdir: context.rulesSubdir, preparationStage: context.preparationStage });
    const existing = onboardingCache.get(key);
    if (existing !== undefined) return existing;
    const prepared = prepareOnboarding.prepare(request);
    onboardingCache.set(key, prepared);
    return prepared;
  } };
  const assemble = createPublicationAssembler({ request: preparation, assemble: assembleAuthoredCoreDistribution, createServices: () => createCoreServices({ buildVersion, environmentCap, workRoot: workspace, processes, directories }, onboarding, copy), createSource: request => createSourceContextDistributionSource({ ...request, context: config => { const reader = createSourceRuntimeContextReader({ ...config, processes, beforeHost, delivery: copy === undefined ? "copy" : "native" }); return { load: async location => { const prepared = await reader.load(location); if (prepared.status === "invalid") return prepared; const inputs = mergeSourceDigests({ groups: [prepared.value.inputs, productionInputs.filter(input => input.path === "package.json" || input.path === "bun.lock")] }); return inputs.status === "invalid" ? inputs : { status: "ok", value: { ...prepared.value, context: { ...prepared.value.context, ...(beforeHost ? { preparationStage: "before-host" as const } : {}) }, inputs: inputs.value } }; } }; } }), createSettings: request => createHarnessSettingsDistributionSource({ ...request, onboarding, environmentCap, processes, directories }), createContracts: request => createSourceContractDistributionSource({ ...request, prepare: () => createSourceRuntimeContractPreparer({ processes }) }), createAuthoring: request => createPluginAuthoringDistributionSource({ ...request, prepare: () => createSourcePluginAuthoringPreparer({ processes }) }), createModules: request => createSourceModuleDistributionSource({ ...request, prepare: () => createSourceRuntimeModulePreparer({ buildVersion, processes }) }) });
    const prepared = await assemble({ location: { sourceRoot, root: runtimeRoot, basis: { source: { kind: "core", id: "framework" }, pin } }, binding, contextRoot: workspace, mode, modelInvocation: profile.modelInvocation, stageDocuments: "project-authored", methodRuntime: "prepare-authored", workflowReferences: "prepare-compiled" });
    if (prepared.status === "invalid") throw new Error(prepared.findings.map(finding => `${finding.subject}: ${finding.detail}`).join("\n"));
    if (createHash("sha1").update(packageInputsFingerprint(sourceRoot)).digest("hex") !== pin) throw new Error("Source changed during assembly");
    if (productionInputs !== null) {
      verifyProductionInputs(productionInputs, observeProductionInputs(sourceRoot));
      verifyProductionInputs(productionInputs, prepared.value.artifact.sourceInputs ?? []);
    }
    return { ...prepared.value.artifact, evaluation: { buildVersion, environmentCap, delivery: copy === undefined ? "copy" : "native" } };
  } finally {
    removeDistributionDirectory({ directories: workspaceDirectories, root: workspace });
  }
}
function publishCore(artifact: IssuedProjectionDistribution, outRoot: string): { readonly files: number; readonly sourceInputs: number } {
  const output = resolve(outRoot);
  for (const directory of artifact.distribution.directories) {
    const target = resolve(output, directory.path);
    if (!target.startsWith(output + sep)) throw new Error(`Projection escaped its output root: ${directory.path}`);
    mkdirSync(target, { recursive: true });
    if (artifact.distribution.structure?.kind === "prepared-root") chmodSync(target, directory.mode);
  }
  for (const file of artifact.distribution.files) {
    const target = resolve(output, file.path);
    if (!target.startsWith(output + sep)) throw new Error(`Projection escaped its output root: ${file.path}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.bytes);
    chmodSync(target, file.mode);
  }
  return { files: artifact.distribution.files.length, sourceInputs: artifact.sourceInputs?.length ?? 0 };
}
async function assemblePublicCore(request: ClaudeCopyRequest, binding: HarnessBinding, delivery: "copy" | "native"): Promise<IssuedProjectionDistribution> {
  // tmpdir is an ambient parent and may contain legitimate source checkouts.
  // Only this owned workspace, not its parent, must be separate from source.
  const workRoot = mkdtempSync(join(tmpdir(), "aidlc-core-evaluation-"));
  try { return await assembleFreshCore({ request, binding, delivery, workRoot }); }
  finally { rmSync(workRoot, { recursive: true, force: true }); }
}
export async function assembleCoreCopy(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<IssuedProjectionDistribution> {
  return assemblePublicCore(request, binding, "copy");
}
export async function projectCoreCopy(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<{ readonly files: number; readonly sourceInputs: number }> {
  return publishCore(await assembleCoreCopy(request, binding), request.outRoot);
}
export async function assembleCoreNative(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<IssuedProjectionDistribution> {
  return assemblePublicCore(request, binding, "native");
}
// Process entry for source-local assembly; public assembly APIs own freshness.
export async function assembleSourceCore(request: ClaudeCopyRequest, { binding, delivery, runtimeDirectories, directories }: { readonly binding: HarnessBinding; readonly delivery: "copy" | "native"; readonly runtimeDirectories: ChildRuntimeDirectories; readonly directories: DistributionDirectoryFactory }): Promise<IssuedProjectionDistribution> {
  if (delivery === "copy") return assembleCore(request, binding, { runtimeDirectories, directories });
  return (await assembleSourceCorePair(request, { binding, runtimeDirectories, directories }))[1];
}
export async function assembleSourceCorePair(request: ClaudeCopyRequest, { binding, runtimeDirectories, directories }: { readonly binding: HarnessBinding; readonly runtimeDirectories: ChildRuntimeDirectories; readonly directories: DistributionDirectoryFactory }): Promise<readonly [IssuedProjectionDistribution, IssuedProjectionDistribution]> {
  const { buildVersion, environmentCap } = copyRequestSchema.parse(request);
  const copy = await assembleCore(request, binding, { runtimeDirectories, directories });
  const native = await assembleCore(request, binding, { runtimeDirectories, directories }, { profile: { buildVersion, environmentCap }, basis: copy.distribution.seed, files: copy.distribution.files, inputs: copy.sourceInputs ?? [] });
  return [copy, native];
}
export async function projectCorePair(request: ClaudeCopyRequest, binding: HarnessBinding, nativeOutRoot: string): Promise<{ readonly copy: { readonly files: number; readonly sourceInputs: number }; readonly native: { readonly files: number; readonly sourceInputs: number } }> {
  const workRoot = mkdtempSync(join(tmpdir(), "aidlc-core-pair-"));
  try {
    const [copy, native] = await assembleFreshCorePair({ request, binding, workRoot });
    return { copy: publishCore(copy, request.outRoot), native: publishCore(native, nativeOutRoot) };
  } finally { rmSync(workRoot, { recursive: true, force: true }); }
}
export async function projectCoreNative(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<{ readonly files: number; readonly sourceInputs: number }> {
  return publishCore(await assembleCoreNative(request, binding), request.outRoot);
}
export type CorePublicationStep = { readonly binding: HarnessBinding; readonly copyRoot: string; readonly nativeRoot: string };
export async function projectCorePublicationSession(request: ClaudeCopyRequest, steps: readonly CorePublicationStep[]): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const roots = steps.flatMap(step => [step.copyRoot, step.nativeRoot]).map(root => { const absolute = resolve(root); return process.platform === "win32" ? absolute.toLowerCase() : absolute; });
  if (roots.length === 0 || new Set(roots).size !== roots.length || roots.some((root, index) => roots.some((other, otherIndex) => index !== otherIndex && root.startsWith(other + sep)))) throw new Error("A publication session requires distinct non-overlapping output roots");
  const workRoot = mkdtempSync(join(tmpdir(), "aidlc-core-session-"));
  try {
    const issued = await assembleFreshCoreSession({ request, steps: steps.map(step => ({ binding: harnessBindingSchema.parse({ harness: step.binding.harness, directory: step.binding.directory }), delivery: "paired" })), workRoot });
    for (const [index, step] of steps.entries()) { publishCore(issued[index]![0]!, step.copyRoot); publishCore(issued[index]![1]!, step.nativeRoot); }
    return issued[0]![0]!.sourceDiagnostics ?? { stdout: "", stderr: "" };
  } finally { rmSync(workRoot, { recursive: true, force: true }); }
}
if (import.meta.main) {
  const input: unknown = await Bun.stdin.json();
  const request = copyRequestSchema.extend({ harness: z.enum(["claude", "codex", "cursor", "kiro", "kiro-ide", "copilot", "opencode"]), delivery: z.enum(["copy", "native", "paired"]), nativeOutRoot: z.string().min(1).optional() }).parse(input);
  const binding = qualifiedHarnessByName({ name: request.harness, harnessDir: (request.harness === "copilot" || request.harness === "opencode") ? ".aidlc" : request.harness === "kiro-ide" ? ".kiro" : `.${request.harness}` });
  if (binding === null) throw new Error("Host projection profile is not qualified");
  const profile = copyRequestSchema.parse({ sourceRoot: request.sourceRoot, outRoot: request.outRoot, buildVersion: request.buildVersion, environmentCap: request.environmentCap });
  if ((request.delivery === "paired") !== (request.nativeOutRoot !== undefined)) throw new Error("Paired delivery requires exactly one explicit native output root");
  console.log(JSON.stringify(await (request.delivery === "paired" ? projectCorePair(profile, binding, request.nativeOutRoot!) : request.delivery === "native" ? projectCoreNative(profile, binding) : projectCoreCopy(profile, binding))));
}
