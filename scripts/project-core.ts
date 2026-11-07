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
import { qualifiedHarnessProfile, qualifiedHarnessByName } from "./projection/src/adapters/qualified-harness-profile.ts";
import { createOnboardingPreparer, type OnboardingPreparer } from "./projection/src/adapters/onboarding-source.ts";
import { createOnboardingProductServices, prepareOnboardingProducts } from "./projection/examples/onboarding-products.ts";
import { createHarnessSettingsDistributionSource } from "./projection/examples/harness-settings-distribution.ts";
import type { PairedCopyDescription } from "./projection/src/domain/distribution-description.ts";
import type { IssuedProjectionDistribution } from "./projection/examples/projection-distribution.ts";
import { createSourceContextDistributionSource } from "./projection/examples/source-context-distribution.ts";
import { createSourceRuntimeContextReader } from "./projection/src/adapters/source-runtime-context.ts";

function createCoreServices({ buildVersion, environmentCap }: ClaudeCopyProfile, onboarding: OnboardingPreparer, copy?: PairedCopyDescription) {
  return createDescribedCoreDistributionServices({
    core: () => {
      const documents = createCoreDocumentServices();
      const policy = createCoreAgentPolicyReader();
      return { ...createCoreDocumentDistributionServices(), documents: request => prepareCoreAuthoredDocuments({ ...request, services: { ...documents, policy: { load: location => policy.load({ ...location, environmentCap }) }, onboarding: request => prepareOnboardingProducts({ ...request, services: { ...createOnboardingProductServices(), preparation: onboarding } }) } }) };
    },
    description: ({ rules }) => createCoreDescriptionServices({ rules, preparation: () => createSourceDescriptionPreparer({ buildVersion, ...(copy === undefined ? {} : { nativePair: { profile: { buildVersion, environmentCap }, copy } }) }) }),
  });
}

export const copyRequestSchema = z.strictObject({ sourceRoot: z.string().min(1), outRoot: z.string().min(1), buildVersion: z.string().min(1), environmentCap: z.enum(["judgment", "balanced", "templated"]).nullable() });

async function assembleCore(request: ClaudeCopyRequest, binding: HarnessBinding, copy?: PairedCopyDescription): Promise<IssuedProjectionDistribution> {
  const { sourceRoot, buildVersion, environmentCap } = copyRequestSchema.parse(request);
  const workspace = mkdtempSync(join(tmpdir(), "aidlc-retained-projection-"));
  const owned = resolve(workspace);
  if (!owned.startsWith(resolve(tmpdir()) + sep)) throw new Error("Projection workspace escaped temporary root");
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
  const prepareOnboarding = createOnboardingPreparer();
  const onboardingCache = new Map<string, ReturnType<OnboardingPreparer["prepare"]>>();
  const onboarding: OnboardingPreparer = { prepare: request => {
    const { sourceRoot, basis, context } = request;
    const key = JSON.stringify({ sourceRoot, basis, harness: context.harness, directory: context.directory, invocation: context.invocation, rulesSubdir: context.rulesSubdir });
    const existing = onboardingCache.get(key);
    if (existing !== undefined) return existing;
    const prepared = prepareOnboarding.prepare(request);
    onboardingCache.set(key, prepared);
    return prepared;
  } };
  const assemble = createPublicationAssembler({ request: preparation, assemble: assembleAuthoredCoreDistribution, createServices: () => createCoreServices({ buildVersion, environmentCap }, onboarding, copy), createSource: request => createSourceContextDistributionSource({ ...request, context: config => createSourceRuntimeContextReader({ ...config, delivery: copy === undefined ? "copy" : "native" }) }), createSettings: request => createHarnessSettingsDistributionSource({ ...request, onboarding }), createModules: request => createSourceModuleDistributionSource({ ...request, prepare: () => createSourceRuntimeModulePreparer({ buildVersion }) }) });
  try {
    const prepared = await assemble({ location: { sourceRoot, root: runtimeRoot, basis: { source: { kind: "core", id: "framework" }, pin } }, binding, contextRoot: workspace, mode, modelInvocation: profile.modelInvocation, stageDocuments: "project-authored", methodRuntime: "prepare-authored", workflowReferences: "prepare-compiled" });
    if (prepared.status === "invalid") throw new Error(prepared.findings.map(finding => `${finding.subject}: ${finding.detail}`).join("\n"));
    if (createHash("sha1").update(packageInputsFingerprint(sourceRoot)).digest("hex") !== pin) throw new Error("Source changed during assembly");
    return prepared.value.artifact;
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
}
function publishCore(artifact: IssuedProjectionDistribution, outRoot: string): { readonly files: number; readonly sourceInputs: number } {
  const output = resolve(outRoot);
  for (const file of artifact.distribution.files) {
    const target = resolve(output, file.path);
    if (!target.startsWith(output + sep)) throw new Error(`Projection escaped its output root: ${file.path}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.bytes);
    chmodSync(target, file.mode);
  }
  return { files: artifact.distribution.files.length, sourceInputs: artifact.sourceInputs?.length ?? 0 };
}
export async function assembleCoreCopy(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<IssuedProjectionDistribution> {
  return assembleCore(request, binding);
}
export async function projectCoreCopy(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<{ readonly files: number; readonly sourceInputs: number }> {
  return publishCore(await assembleCoreCopy(request, binding), request.outRoot);
}
export async function assembleCoreNative(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<IssuedProjectionDistribution> {
  const { buildVersion, environmentCap } = copyRequestSchema.parse(request);
  const copy = await assembleCore(request, binding);
  return assembleCore(request, binding, { profile: { buildVersion, environmentCap }, basis: copy.distribution.seed, files: copy.distribution.files, inputs: copy.sourceInputs ?? [] });
}
export async function projectCoreNative(request: ClaudeCopyRequest, binding: HarnessBinding): Promise<{ readonly files: number; readonly sourceInputs: number }> {
  return publishCore(await assembleCoreNative(request, binding), request.outRoot);
}
if (import.meta.main) {
  const input: unknown = await Bun.stdin.json();
  const request = copyRequestSchema.extend({ harness: z.enum(["claude", "codex"]), delivery: z.enum(["copy", "native"]) }).parse(input);
  const binding = qualifiedHarnessByName({ name: request.harness, harnessDir: `.${request.harness}` });
  if (binding === null) throw new Error("Host projection profile is not qualified");
  const profile = copyRequestSchema.parse({ sourceRoot: request.sourceRoot, outRoot: request.outRoot, buildVersion: request.buildVersion, environmentCap: request.environmentCap });
  console.log(JSON.stringify(await (request.delivery === "native" ? projectCoreNative(profile, binding) : projectCoreCopy(profile, binding))));
}
