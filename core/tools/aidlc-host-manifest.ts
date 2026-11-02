import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { jsonFileText, sha256Bytes, sha256Matching, withoutBom } from "./aidlc-distribution.ts";
import {
  type ProjectedPluginHookContributions,
  type RecordedPluginHookContributions,
  recordedPluginHookContributions,
} from "./aidlc-plugin-hook-registrations.ts";

const hashRecordSchema = z.record(z.string(), z.string());

const hostManifestSchema = z.looseObject({
  schemaVersion: z.literal(1),
  files: hashRecordSchema,
  generatedSkillProseHashes: hashRecordSchema.optional(),
  entries: z.record(z.string(), z.unknown()).optional(),
});

type HostManifest = z.infer<typeof hostManifestSchema>;

type SyncedFile = { readonly path: string; readonly installed: Buffer; readonly staged: Buffer };

type SyncedHostManifestPlan =
  | { readonly kind: "unchanged" }
  | { readonly kind: "planned"; readonly manifest: HostManifest };

type SyncedManagedFilesRecording =
  | { readonly kind: "recorded" }
  | { readonly kind: "unchanged" }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly note: string };

type SyncedProject = { readonly projectDir: string; readonly stagedProject: string; readonly harnessDir: string };

type ParsedJson = { readonly kind: "parsed"; readonly text: string; readonly value: unknown } | { readonly kind: "invalid" };

type StagedHookContributions =
  | { readonly kind: "parsed"; readonly value: readonly ProjectedPluginHookContributions[] }
  | { readonly kind: "invalid" };

const GENERATED_SKILL_SUFFIX = "/skills/aidlc/SKILL.md";
const STAGE_REGION = /<!-- BEGIN: compiled stage graph[^\n]* -->[\s\S]*?<!-- END: compiled stage graph -->/g;
const SCOPE_REGION = /<!-- BEGIN: compiled scope grid[^\n]* -->[\s\S]*?<!-- END: compiled scope grid -->/g;
const PLUGIN_CONTRIBUTION_SIDECAR = /^plugin-contrib-.+\.json$/;

function isGeneratedSkillPath(path: string): boolean {
  return path.endsWith(GENERATED_SKILL_SUFFIX);
}

function generatedSkillProseHash(input: { readonly content: string }): string | null {
  const normalized = input.content.replaceAll("\r\n", "\n");
  if ([...normalized.matchAll(STAGE_REGION)].length !== 1 || [...normalized.matchAll(SCOPE_REGION)].length !== 1) return null;
  return sha256Bytes(normalized.replace(STAGE_REGION, "<!-- compiled stage -->").replace(SCOPE_REGION, "<!-- compiled scope -->"));
}

function generatedSkillOwned(input: {
  readonly installed: string;
  readonly equivalents: readonly string[];
  readonly recorded: { readonly hash: string | undefined; readonly proseHash: string | undefined };
}): boolean {
  const installedProseHash = generatedSkillProseHash({ content: input.installed });
  return [input.installed, ...input.equivalents].some((form) => sha256Bytes(form) === input.recorded.hash) ||
    (input.recorded.proseHash !== undefined && installedProseHash === input.recorded.proseHash);
}

function coreBaselinePaths(input: {
  readonly harnessDir: string;
  readonly manifest: HostManifest;
  readonly hookContributions: readonly ProjectedPluginHookContributions[];
}): ReadonlySet<string> {
  const hookDocuments = input.hookContributions.flatMap((contribution) =>
    contribution.registrations.map((registration) => registration.path));
  const trustSeed = hookDocuments.includes(`${input.harnessDir}/hooks.json`) ? [`${input.harnessDir}/trust-seed.toml`] : [];
  return new Set([...hookDocuments, ...trustSeed, ...Object.keys(input.manifest.entries ?? {})]);
}

function ownedBeforeSync(input: { readonly file: SyncedFile; readonly manifest: HostManifest }): boolean {
  const recordedHash = input.manifest.files[input.file.path];
  if (!isGeneratedSkillPath(input.file.path)) return sha256Matching(input.file.installed, [recordedHash]) === recordedHash;
  return generatedSkillOwned({
    installed: input.file.installed.toString("utf-8").replaceAll("\r\n", "\n"),
    equivalents: [],
    recorded: { hash: recordedHash, proseHash: input.manifest.generatedSkillProseHashes?.[input.file.path] },
  });
}

function rehashedFiles(input: {
  readonly files: Readonly<Record<string, string>>;
  readonly rewritten: readonly SyncedFile[];
}): Record<string, string> {
  return { ...input.files, ...Object.fromEntries(input.rewritten.map((file) => [file.path, sha256Bytes(file.staged)])) };
}

function rehashedProse(input: {
  readonly proseHashes: Readonly<Record<string, string>>;
  readonly rewritten: readonly SyncedFile[];
}): Record<string, string> {
  const rewrittenPaths = new Set(input.rewritten.map((file) => file.path));
  const kept = Object.entries(input.proseHashes).filter(([path]) => !rewrittenPaths.has(path));
  const recomputed = input.rewritten.filter((file) => isGeneratedSkillPath(file.path)).flatMap((file): Array<[string, string]> => {
    const proseHash = generatedSkillProseHash({ content: file.staged.toString("utf-8") });
    return proseHash === null ? [] : [[file.path, proseHash]];
  });
  return Object.fromEntries([...kept, ...recomputed].sort(([left], [right]) => left.localeCompare(right)));
}

function planSyncedHostManifest(input: {
  readonly manifest: HostManifest;
  readonly coreBaselinePaths: ReadonlySet<string>;
  readonly files: readonly SyncedFile[];
}): SyncedHostManifestPlan {
  const rewritten = input.files.filter((file) => !input.coreBaselinePaths.has(file.path) &&
    !file.installed.equals(file.staged) && ownedBeforeSync({ file, manifest: input.manifest }));
  if (rewritten.length === 0) return { kind: "unchanged" };
  return {
    kind: "planned",
    manifest: {
      ...input.manifest,
      files: rehashedFiles({ files: input.manifest.files, rewritten }),
      generatedSkillProseHashes: rehashedProse({ proseHashes: input.manifest.generatedSkillProseHashes ?? {}, rewritten }),
    },
  };
}

function regularFileBytes(path: string): Buffer | null {
  return existsSync(path) && lstatSync(path).isFile() ? readFileSync(path) : null;
}

function parsedJsonFile(path: string): ParsedJson {
  const bytes = regularFileBytes(path);
  if (bytes === null) return { kind: "invalid" };
  const text = bytes.toString("utf-8");
  try {
    return { kind: "parsed", text, value: JSON.parse(withoutBom(text)) };
  } catch {
    return { kind: "invalid" };
  }
}

function sidecarHookContributions(path: string): RecordedPluginHookContributions {
  const sidecar = parsedJsonFile(path);
  return sidecar.kind === "parsed" ? recordedPluginHookContributions({ sidecar: sidecar.value }) : { kind: "invalid" };
}

function stagedHookContributions(input: SyncedProject): StagedHookContributions {
  const dataDir = join(input.stagedProject, input.harnessDir, "tools", "data");
  const sidecars = readdirSync(dataDir).filter((name) => PLUGIN_CONTRIBUTION_SIDECAR.test(name))
    .map((name) => sidecarHookContributions(join(dataDir, name)));
  if (sidecars.some((sidecar) => sidecar.kind === "invalid")) return { kind: "invalid" };
  return { kind: "parsed", value: sidecars.flatMap((sidecar) => sidecar.kind === "parsed" ? [sidecar.value] : []) };
}

function syncedFiles(input: SyncedProject & { readonly manifest: HostManifest }): readonly SyncedFile[] {
  return Object.keys(input.manifest.files).flatMap((path): SyncedFile[] => {
    const installed = regularFileBytes(join(input.projectDir, path));
    const staged = regularFileBytes(join(input.stagedProject, path));
    return installed === null || staged === null ? [] : [{ path, installed, staged }];
  });
}

function recordSyncedManagedFiles(input: SyncedProject): SyncedManagedFilesRecording {
  const manifestRelative = `${input.harnessDir}/tools/data/aidlc-manifest.json`;
  const manifestPath = join(input.stagedProject, manifestRelative);
  if (!existsSync(manifestPath)) return { kind: "absent" };
  const invalid: SyncedManagedFilesRecording = {
    kind: "invalid",
    note: `${manifestRelative} was not updated for synced files: the host manifest or a plugin sidecar is invalid`,
  };
  const parsed = parsedJsonFile(manifestPath);
  if (parsed.kind === "invalid") return invalid;
  const manifest = hostManifestSchema.safeParse(parsed.value);
  const hookContributions = stagedHookContributions(input);
  if (!manifest.success || hookContributions.kind === "invalid") return invalid;
  const plan = planSyncedHostManifest({
    manifest: manifest.data,
    coreBaselinePaths: coreBaselinePaths({
      harnessDir: input.harnessDir,
      manifest: manifest.data,
      hookContributions: hookContributions.value,
    }),
    files: syncedFiles({ ...input, manifest: manifest.data }),
  });
  if (plan.kind === "unchanged") return { kind: "unchanged" };
  writeFileSync(manifestPath, jsonFileText(plan.manifest, parsed.text));
  return { kind: "recorded" };
}

export {
  type HostManifest,
  type SyncedFile,
  type SyncedHostManifestPlan,
  type SyncedManagedFilesRecording,
  coreBaselinePaths,
  generatedSkillOwned,
  generatedSkillProseHash,
  isGeneratedSkillPath,
  planSyncedHostManifest,
  recordSyncedManagedFiles,
};
