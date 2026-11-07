import { mkdirSync, mkdtempSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { assembleAuthoredCoreDistribution } from "./projection/examples/core-distribution.ts";
import { createDescribedCoreDistributionServices } from "./projection/examples/described-core-distribution.ts";
import { createPublicationAssembler } from "./projection/examples/publication-assembly.ts";
import { packageInputsFingerprint } from "./package-sources.ts";
import { projectionModes } from "./projection-process.ts";

export async function projectClaudeCopy({ sourceRoot, outRoot }: { readonly sourceRoot: string; readonly outRoot: string }): Promise<{ readonly files: number; readonly sourceInputs: number }> {
  const workspace = mkdtempSync(join(tmpdir(), "aidlc-clean-claude-"));
  const owned = resolve(workspace);
  if (!owned.startsWith(resolve(tmpdir()) + sep)) throw new Error("Projection workspace escaped temporary root");
  const runtimeRoot = join(workspace, "input");
  mkdirSync(runtimeRoot);
  const { fileMode: mode, directoryMode } = projectionModes({ platform: process.platform, umask: process.umask() });
  const pin = createHash("sha1").update(packageInputsFingerprint(sourceRoot)).digest("hex");
  const request = {
    runtimeContext: "prepare-source", runtimeAssets: "prepare-authored", runtimeContracts: "prepare-source",
    runtimeModules: "prepare-source", pluginAuthoring: "prepare-source", harnessSettings: "prepare-source", workspaceSeed: "prepare-source",
    directories: { kind: "file-parents", mode: directoryMode }, mode,
  } as const;
  const assemble = createPublicationAssembler({ request, assemble: assembleAuthoredCoreDistribution, createServices: createDescribedCoreDistributionServices });
  try {
    const prepared = await assemble({ location: { sourceRoot, root: runtimeRoot, basis: { source: { kind: "core", id: "framework" }, pin } }, binding: { harness: "claude", directory: ".claude" }, contextRoot: workspace, mode, modelInvocation: "native-default", stageDocuments: "project-authored", methodRuntime: "prepare-authored", workflowReferences: "prepare-compiled" });
    if (prepared.status === "invalid") throw new Error(prepared.findings.map(finding => `${finding.subject}: ${finding.detail}`).join("\n"));
    const output = resolve(outRoot);
    for (const file of prepared.value.artifact.distribution.files) {
      const target = resolve(output, file.path);
      if (!target.startsWith(output + sep)) throw new Error(`Projection escaped its output root: ${file.path}`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.bytes);
      chmodSync(target, file.mode);
    }
    return { files: prepared.value.artifact.distribution.files.length, sourceInputs: prepared.value.artifact.sourceInputs?.length ?? 0 };
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
}
if (import.meta.main) {
  const request = await Bun.stdin.json() as { sourceRoot: string; outRoot: string };
  console.log(JSON.stringify(await projectClaudeCopy(request)));
}
