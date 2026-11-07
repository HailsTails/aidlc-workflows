import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { manifestEmitter } from "./manifest-capabilities.ts";
import { materializeArtifactData } from "./fresh-core-assembly.ts";
import { ordinarySourcePath, observeProductionInputs, verifyProductionInputs } from "./source-input-contract.ts";
import { qualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment } from "./native-compiler-process.ts";
import { assembledProjectionRoot, applyPreparedHostRoot, type HostDistributionPreparer } from "../application/host-distribution-preparation.ts";
import { hostRootChanges, type DistributionRoot, type PreparedHostRoot } from "../domain/prepared-host-root.ts";
import { prepareDistributionStructure } from "../domain/distribution-structure.ts";
import { finding, pathStatus, type Outcome, type Tier } from "../domain/model.ts";
import type { ProjectionDistributionRequest } from "../application/projection-distribution-request.ts";
import type { HarnessManifest } from "../../../manifest-types.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";

export async function sourceHostEmissionSelected(sourceRoot: string, binding: HarnessBinding): Promise<boolean> {
  if (!["claude", "opencode"].includes(binding.harness)) return false;
  const module = await import(Bun.pathToFileURL(join(sourceRoot, "harness", binding.harness, "manifest.ts")).href);
  return manifestEmitter(module.default) !== null;
}

const fileSchema = z.strictObject({ path: z.string().refine(path => pathStatus({ path }) === "safe"), bytes: z.instanceof(Uint8Array), mode: z.number().int().min(0).max(0o777) });
const rootSchema = z.strictObject({ files: z.array(fileSchema), directories: z.array(fileSchema.omit({ bytes: true })), added: z.array(z.string()), replaced: z.array(z.string()), removed: z.array(z.string()), directoriesAdded: z.array(z.string()), directoriesChanged: z.array(z.string()), directoriesRemoved: z.array(z.string()), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) });
type EmissionRequest = { readonly request: ProjectionDistributionRequest; readonly before: DistributionRoot; readonly workRoot: string; readonly environmentCap: Tier | null; readonly buildVersion: string };
const refuse = (detail: string): Outcome<never> => ({ status: "invalid", findings: [finding({ code: "capability-gap", subject: "manifest-emission", detail })] });
function readRoot(root: string): DistributionRoot {
  const files: DistributionRoot["files"][number][] = [], directories: DistributionRoot["directories"][number][] = [];
  const visit = (absolute: string): void => {
    const stat = lstatSync(absolute), path = relative(root, absolute).split(sep).join("/");
    if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) throw new Error(`Manifest emit returned an unsupported filesystem entry: ${path}`);
    if (path && pathStatus({ path }) !== "safe") throw new Error(`Manifest emit returned an unsafe path: ${path}`);
    if (stat.isDirectory()) { if (path) directories.push({ path, mode: stat.mode & 0o777 }); for (const name of readdirSync(absolute).sort()) visit(join(absolute, name)); }
    else files.push({ path, bytes: readFileSync(absolute), mode: stat.mode & 0o777 });
  };
  visit(root);
  return { files, directories };
}
function writeRoot(root: string, inventory: DistributionRoot): void {
  mkdirSync(root);
  for (const directory of inventory.directories) mkdirSync(join(root, directory.path), { recursive: true, mode: directory.mode });
  for (const file of inventory.files) { mkdirSync(dirname(join(root, file.path)), { recursive: true }); writeFileSync(join(root, file.path), file.bytes); chmodSync(join(root, file.path), file.mode); }
}

// Compatibility host code runs inside the fresh source session over a private root.
// This is source freshness and output ownership, not a hostile-code sandbox.
export async function evaluateManifestHostRoot({ request, before, workRoot, environmentCap, buildVersion }: EmissionRequest): Promise<PreparedHostRoot | null> {
  const { sourceRoot, seed } = request;
  const inputs = observeProductionInputs(sourceRoot);
  const manifestPath = `harness/${seed.binding.harness}/manifest.ts`;
  const manifest: HarnessManifest = (await import(Bun.pathToFileURL(join(sourceRoot, manifestPath)).href)).default;
  const emit = manifestEmitter(manifest);
  if (emit === null) { verifyProductionInputs(inputs, observeProductionInputs(sourceRoot)); return null; }
  const root = join(workRoot, "root");
  writeRoot(root, before);
  const native = seed.invocation === "aidlc";
  const [text, commands, tiers] = await Promise.all(["scripts/projection-text.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-tiers.ts"].map(path => import(Bun.pathToFileURL(join(sourceRoot, path)).href)));
  const letters = manifest.questionOptions ?? 5;
  if (!Number.isInteger(letters) || letters < 2 || letters > 5) throw new Error("Manifest questionOptions must be a whole number from 2 to 5");
  const binding = { invoke: seed.invocation, toolPrefix: native ? `${commands.TRUSTED_COMMAND_PREFIX} ` : `bun ${seed.binding.directory}/tools/`, trustedNamespace: commands.TRUSTED_ROUTE_NAMESPACE };
  const substituteToken = (source: string) => text.substituteAuthoredTokens({ source, harnessDir: seed.binding.directory, letters: `A-${"ABCDE"[letters - 1]}`, binding });
  const observedBefore = readRoot(root);
  emit.call(manifest, { repoRoot: sourceRoot, coreRoot: join(sourceRoot, "core"), harnessRoot: join(sourceRoot, "harness", manifest.name), harnessName: manifest.name, distRoot: root, harnessDir: manifest.harnessDir, trustedRouteNamespace: commands.TRUSTED_ROUTE_NAMESPACE, substituteToken, tierCap: environmentCap ?? tiers.readMemoryCap(join(sourceRoot, "core", "memory")) });
  let emitted = readRoot(root);
  if (manifest.tierFlavor === "claude") {
    const [settings, dispatcher] = await Promise.all(["scripts/claude-settings.ts", "core/tools/aidlc.ts"].map(path => import(Bun.pathToFileURL(join(sourceRoot, path)).href)));
    const path = `${manifest.harnessDir}/settings.json`, file = emitted.files.find(file => file.path === path);
    if (file === undefined) throw new Error("Manifest emit removed required Claude settings.json");
    const value = JSON.parse(new TextDecoder().decode(file.bytes));
    const expanded = settings.prepareClaudeCopyAllowList({ allow: value.permissions?.allow, authority: { dispatcherCommands: dispatcher.copyChannelDispatcherCommands, toolScripts: dispatcher.copyChannelToolScripts } });
    if (expanded.kind !== "prepared") throw new Error(expanded.message);
    value.permissions.allow = expanded.allow;
    writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);
    emitted = readRoot(root);
  }
  const [metadata, distribution] = await Promise.all(["scripts/projection/native/projection-metadata.ts", "core/tools/aidlc-distribution.ts"].map(path => import(Bun.pathToFileURL(join(sourceRoot, path)).href)));
  const rootFiles = manifest.rootIntegrations.filter(integration => distribution.shipsRootBlock(integration)).map(integration => {
    const bytes = readFileSync(join(root, integration.path));
    return { path: integration.path, fileName: integration.path.split("/").at(-1)!, bytes, sha256: distribution.sha256Bytes(bytes) };
  });
  const described = metadata.prepareProjectionMetadata({ declaration: manifest, files: emitted.files.map(file => file.path), directories: emitted.directories.map(directory => directory.path), rootFiles, buildVersion });
  if (described.kind !== "prepared") throw new Error(described.message);
  for (const artifact of described.artifacts) { mkdirSync(dirname(join(root, artifact.file)), { recursive: true }); writeFileSync(join(root, artifact.file), artifact.bytes); }
  const skillPath = manifest.orchestratorSkillPath ?? `${manifest.harnessDir}/skills/aidlc/SKILL.md`;
  if (pathStatus({ path: skillPath }) !== "safe") throw new Error("Manifest orchestrator path must be relative and safe");
  const tablesPath = join(dirname(join(root, skillPath)), "tables.md");
  const regions = await import(Bun.pathToFileURL(join(sourceRoot, "scripts/generated-skill-regions.ts")).href);
  if (existsSync(tablesPath)) {
    let body = readFileSync(tablesPath, "utf8").replace(/\r\n/g, "\n");
    const operations = createNativeCompilerProcessOperations({ timeout: 30000 });
    const engineRoot = join(root, manifest.harnessDir);
    for (const region of regions.GENERATED_SKILL_REGIONS) {
      const reply = operations.spawn({ binary: process.execPath, args: ["--no-env-file", "--no-install", join(engineRoot, "tools/aidlc-utility.ts"), region.verb], cwd: engineRoot, input: "", env: { ...privateCompilerEnvironment({ inherited: operations.environment(), root: workRoot }), AIDLC_SRC: engineRoot, AIDLC_HARNESS_DIR: manifest.harnessDir, AIDLC_HARNESS_NAME: manifest.name, AIDLC_PROJECT_DIR: root, AIDLC_RUNTIME_PROJECT_DIR: root, AIDLC_RUNTIME_HARNESS_ROOT: engineRoot } });
      if (reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim()) throw new Error(reply.stderr || reply.error || "Emitted table finalization failed");
      const replaced = regions.replaceGeneratedSkillRegion({ text: body, rendered: reply.stdout.trimEnd(), region, path: tablesPath });
      if (replaced.status !== "ok") throw new Error(replaced.detail);
      body = replaced.text;
    }
    writeFileSync(tablesPath, body);
  }
  const compatibility = await import(Bun.pathToFileURL(join(sourceRoot, "scripts/earlier-release-regions.ts")).href);
  if (compatibility.earlierReleasesReadSkill(skillPath, manifest.harnessDir)) writeFileSync(join(root, skillPath), compatibility.prepareEarlierReleaseSkillText({ text: readFileSync(join(root, skillPath), "utf8"), skillRel: skillPath, harnessDir: manifest.harnessDir }));
  emitted = readRoot(root);
  if (native) {
    const policy = await import(Bun.pathToFileURL(join(sourceRoot, "scripts/native-runtime-text.ts")).href);
    for (const file of emitted.files) {
      if (!/\.(?:md|mdc|json|toml|hook|ts)$/.test(file.path)) continue;
      const source = Buffer.from(file.bytes).toString("utf8");
      const projected = policy.prepareNativeRuntimeText(policy.prepareNativeOnboardingText(source, manifest.tierFlavor === "claude"), manifest.harnessDir, manifest.name);
      writeFileSync(join(root, file.path), text.substituteInvocationTokens({ source: projected, binding }));
    }
    if (manifest.tierFlavor === "claude") {
      const [settings, dispatcher] = await Promise.all(["scripts/claude-settings.ts", "core/tools/aidlc.ts"].map(path => import(Bun.pathToFileURL(join(sourceRoot, path)).href)));
      const path = join(root, manifest.harnessDir, "settings.json"), value = JSON.parse(readFileSync(path, "utf8"));
      const prepared = settings.prepareClaudeNativeAllowList({ allow: value.permissions?.allow, authority: { trustedCommand: ({ args }: { args: string }) => commands.trustedCommand(args), dispatcherCommands: () => dispatcher.copyChannelDispatcherCommands().map((command: string) => `aidlc ${command}`) } });
      if (prepared.kind !== "prepared") throw new Error(prepared.message);
      value.permissions.allow = prepared.allow;
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    }
  }
  const observedAfter = readRoot(root);
  // Description is reissued from final root bytes, after native policy. It is
  // never claimed by the callback's prepared product.
  const metadataPaths = new Set<string>(described.artifacts.map((artifact: { file: string }) => artifact.file));
  const after = { ...observedAfter, files: observedAfter.files.filter(file => !metadataPaths.has(file.path)) };
  // Preserve canonical seed modes when the host did not change their observed
  // filesystem mode. Newly emitted entries retain the platform's actual mode.
  const directories = after.directories.map(directory => {
    const initial = observedBefore.directories.find(prior => prior.path === directory.path), canonical = before.directories.find(prior => prior.path === directory.path);
    return initial?.mode === directory.mode && canonical !== undefined ? { ...directory, mode: canonical.mode } : directory;
  });
  const prepared = { ...after, directories, inputs, ...hostRootChanges(before, { ...after, directories }) };
  verifyProductionInputs(inputs, observeProductionInputs(sourceRoot));
  return prepared;
}

export function createSourceHostEmissionPreparer({ environmentCap, buildVersion }: { readonly environmentCap: Tier | null; readonly buildVersion: string }): HostDistributionPreparer {
  return { prepare: async request => {
    // These are extension-only manifests. Codex's historical emitter is an
    // original producer already replaced by retained products, not an extension.
    if (!await sourceHostEmissionSelected(request.sourceRoot, request.seed.binding)) return { status: "ok", value: request };
    let owned: string | undefined;
    try {
      ordinarySourcePath(request.sourceRoot, true); ordinarySourcePath(request.root, true);
      const source = resolve(request.sourceRoot).toLowerCase(), work = resolve(request.root).toLowerCase();
      if (source === work || source.startsWith(work + sep) || work.startsWith(source + sep)) throw new Error("Manifest emit requires a separate working root");
      const expected = observeProductionInputs(request.sourceRoot);
      const assembled = assembledProjectionRoot(request);
      const profile = qualifiedHarnessProfile(request.seed.binding)!;
      const roots = profile.rootMappings.filter(mapping => !assembled.files.some(file => file.path === mapping.dst)).map(mapping => ({ path: mapping.dst, bytes: readFileSync(join(request.sourceRoot, "harness", profile.harness, mapping.src)), mode: request.mode }));
      const files = [...assembled.files, ...roots];
      const structure = prepareDistributionStructure({ files, retained: assembled.directories, mode: request.seed.structure?.mode ?? 0o755, rules: { path: pathStatus } });
      if (structure.status === "invalid") return structure;
      const before = { files, directories: structure.value };
      owned = mkdtempSync(join(request.root, "manifest-emission-"));
      const input = materializeArtifactData({ request: { sourceRoot: request.sourceRoot, seed: request.seed, projection: request.projection, mode: request.mode }, before, workRoot: owned, environmentCap, buildVersion }) as EmissionRequest;
      // The enclosing fresh source session owns this callable's module lifetime.
      // Nothing callable enters the root amendment or artifact transport.
      const candidate = materializeArtifactData(await evaluateManifestHostRoot(input));
      verifyProductionInputs(expected, observeProductionInputs(request.sourceRoot));
      if (candidate === null) return { status: "ok", value: request };
      const prepared = rootSchema.parse(candidate);
      verifyProductionInputs(expected, prepared.inputs);
      return applyPreparedHostRoot({ request, before, prepared, origin: { ...request.seed.basis, path: `harness/${request.seed.binding.harness}/manifest.ts` } });
    } catch (error) { return refuse(error instanceof Error ? error.message : "Manifest emission unavailable"); }
    finally { if (owned !== undefined) rmSync(owned, { recursive: true, force: true }); }
  } };
}
