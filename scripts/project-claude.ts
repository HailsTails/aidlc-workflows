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

import type { PairedCopyDescription } from "./projection/src/domain/distribution-description.ts";
import type { IssuedProjectionDistribution } from "./projection/examples/projection-distribution.ts";
import { createSourceContextDistributionSource } from "./projection/examples/source-context-distribution.ts";
import { createSourceRuntimeContextReader } from "./projection/src/adapters/source-runtime-context.ts";

function createClaudeCopyServices({ buildVersion, environmentCap }: ClaudeCopyProfile, copy?: PairedCopyDescription) {
  return createDescribedCoreDistributionServices({
    core: () => {
      const documents = createCoreDocumentServices();
      const policy = createCoreAgentPolicyReader();
      return { ...createCoreDocumentDistributionServices(), documents: request => prepareCoreAuthoredDocuments({ ...request, services: { ...documents, policy: { load: location => policy.load({ ...location, environmentCap }) } } }) };
    },
    description: ({ rules }) => createCoreDescriptionServices({ rules, preparation: () => createSourceDescriptionPreparer({ buildVersion, ...(copy === undefined ? {} : { nativePair: { profile: { buildVersion, environmentCap }, copy } }) }) }),
  });
}

const copyRequestSchema = z.strictObject({ sourceRoot: z.string().min(1), outRoot: z.string().min(1), buildVersion: z.string().min(1), environmentCap: z.enum(["judgment", "balanced", "templated"]).nullable() });

async function assembleClaude(request: ClaudeCopyRequest, copy?: PairedCopyDescription): Promise<IssuedProjectionDistribution> {
  const { sourceRoot, buildVersion, environmentCap } = copyRequestSchema.parse(request);
  const workspace = mkdtempSync(join(tmpdir(), "aidlc-clean-claude-"));
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
  const assemble = createPublicationAssembler({ request: preparation, assemble: assembleAuthoredCoreDistribution, createServices: () => createClaudeCopyServices({ buildVersion, environmentCap }, copy), createSource: request => createSourceContextDistributionSource({ ...request, context: config => createSourceRuntimeContextReader({ ...config, delivery: copy === undefined ? "copy" : "native" }) }), createModules: request => createSourceModuleDistributionSource({ ...request, prepare: () => createSourceRuntimeModulePreparer({ buildVersion }) }) });
  try {
    const prepared = await assemble({ location: { sourceRoot, root: runtimeRoot, basis: { source: { kind: "core", id: "framework" }, pin } }, binding: { harness: "claude", directory: ".claude" }, contextRoot: workspace, mode, modelInvocation: "native-default", stageDocuments: "project-authored", methodRuntime: "prepare-authored", workflowReferences: "prepare-compiled" });
    if (prepared.status === "invalid") throw new Error(prepared.findings.map(finding => `${finding.subject}: ${finding.detail}`).join("\n"));
    if (createHash("sha1").update(packageInputsFingerprint(sourceRoot)).digest("hex") !== pin) throw new Error("Claude source changed during assembly");
    return prepared.value.artifact;
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
}
function publishClaude(artifact: IssuedProjectionDistribution, outRoot: string): { readonly files: number; readonly sourceInputs: number } {
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
export async function projectClaudeCopy(request: ClaudeCopyRequest): Promise<{ readonly files: number; readonly sourceInputs: number }> {
  return publishClaude(await assembleClaude(request), request.outRoot);
}
export async function assembleClaudeNative(request: ClaudeCopyRequest): Promise<IssuedProjectionDistribution> {
  const { buildVersion, environmentCap } = copyRequestSchema.parse(request);
  const copy = await assembleClaude(request);
  return assembleClaude(request, { profile: { buildVersion, environmentCap }, basis: copy.distribution.seed, files: copy.distribution.files, inputs: copy.sourceInputs ?? [] });
}
export async function projectClaudeNative(request: ClaudeCopyRequest): Promise<{ readonly files: number; readonly sourceInputs: number }> {
  return publishClaude(await assembleClaudeNative(request), request.outRoot);
}
if (import.meta.main) {
  const input: unknown = await Bun.stdin.json();
  const request = z.union([copyRequestSchema, copyRequestSchema.extend({ delivery: z.literal("native") })]).parse(input);
  console.log(JSON.stringify("delivery" in request ? await projectClaudeNative(copyRequestSchema.parse({ sourceRoot: request.sourceRoot, outRoot: request.outRoot, buildVersion: request.buildVersion, environmentCap: request.environmentCap })) : await projectClaudeCopy(request)));
}
