import { z } from "zod";
import { sha256Bytes } from "../../../core/tools/aidlc-distribution.ts";
import { createNativeCommandContext } from "../../native-command-context.ts";
import { nativeCommandTextProblems } from "../../native-command-text.ts";
import { pathStatus } from "../src/domain/model.ts";
import type { ProjectionMetadataArtifact, ProjectionMetadataPreparation } from "./projection-metadata.ts";

export type DeliveryDigest = { readonly path: string; readonly sha256: string };
export type DeliveryFile = { readonly path: string; readonly bytes: Uint8Array };
const historySchema = z.record(z.string().refine(path => pathStatus({ path }) === "safe"), z.array(z.string().regex(/^sha256:[a-f0-9]{64}$/)));
const refused = (message: string): ProjectionMetadataPreparation => ({ kind: "refused", message });
const text = (bytes: Uint8Array): string => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);

// Installer migration signatures describe delivered bytes, before ownership is issued.
export function finalizeClaudeNativeMetadata({ artifacts, nativeFiles, copyFiles, history }: { readonly artifacts: readonly ProjectionMetadataArtifact[]; readonly nativeFiles: readonly DeliveryFile[]; readonly copyFiles: readonly DeliveryDigest[]; readonly history: unknown }): ProjectionMetadataPreparation {
  const descriptorPath = ".claude/tools/data/aidlc-projection.json";
  const descriptorFile = artifacts.find(file => file.file === descriptorPath);
  const copyDescriptor = copyFiles.find(file => file.path === descriptorPath);
  if (descriptorFile === undefined || copyDescriptor === undefined) return refused("native delivery requires its producer descriptor and the paired copy descriptor");
  if (copyFiles.some(file => !/^sha256:[a-f0-9]{64}$/.test(file.sha256))) return refused("native delivery requires paired copy SHA-256 digests");
  const parsedHistory = historySchema.safeParse(history);
  if (!parsedHistory.success) return refused("native delivery requires safe copy-era paths and SHA-256 signatures");
  const finalFiles = [...nativeFiles, ...artifacts.map(file => ({ path: file.file, bytes: file.bytes }))];
  for (const files of [finalFiles, copyFiles]) {
    if (new Set(files.map(file => file.path)).size !== files.length || files.some(file => pathStatus({ path: file.path }) !== "safe")) return refused("native delivery requires unique safe file paths in each paired artifact");
  }
  const descriptor = JSON.parse(text(descriptorFile.bytes)) as { managedDirectories: string[]; retiredCopyFileHashes?: Record<string, string[]>; legacyManagedFileHashes?: Record<string, string[]> };
  if (!Array.isArray(descriptor.managedDirectories) || descriptor.managedDirectories.some(path => pathStatus({ path }) !== "safe" || path.includes("/"))) return refused("native delivery requires the producer's managed directory scope");
  const native = new Map(finalFiles.map(file => [file.path, sha256Bytes(Buffer.from(file.bytes))]));
  const copy = new Map(copyFiles.map(file => [file.path, file.sha256]));
  const managed = (path: string) => descriptor.managedDirectories.some(directory => path.startsWith(`${directory}/`));
  const legacy: Record<string, string[]> = {};
  for (const path of [...native.keys()].sort((left, right) => { const a = left.split("/").join("\0"), b = right.split("/").join("\0"); return a < b ? -1 : a > b ? 1 : 0; })) {
    const previous = copy.get(path);
    if (managed(path) && !path.startsWith("aidlc/") && previous !== undefined && previous !== native.get(path)) legacy[path] = [previous];
  }
  const retired: Record<string, string[]> = {};
  for (const [path, hashes] of Object.entries(parsedHistory.data)) {
    if (!managed(path) || path.startsWith("aidlc/")) continue;
    const current = native.get(path);
    if (current === undefined) retired[path] = [...new Set(hashes)].sort();
    else {
      const known = new Set([...(legacy[path] ?? []), ...hashes.filter(hash => hash !== current)]);
      if (known.size > 0) legacy[path] = [...known].sort();
    }
  }
  descriptor.retiredCopyFileHashes = retired;
  legacy[descriptorPath] = [copyDescriptor.sha256];
  descriptor.legacyManagedFileHashes = legacy;
  const result = artifacts.map(file => file.file === descriptorPath ? { ...file, bytes: new TextEncoder().encode(`${JSON.stringify(descriptor, null, 2)}\n`) } : file);
  const context = createNativeCommandContext({ harnessDir: ".claude" });
  const problems = [...nativeFiles, ...result.map(file => ({ path: file.file, bytes: file.bytes }))].flatMap(file => /\.(?:md|mdc|json|toml|hook|ts)$/.test(file.path) ? nativeCommandTextProblems({ source: text(file.bytes), context, subject: file.path }) : []);
  return problems.length > 0 ? refused(`native delivery command validation failed:\n${problems.join("\n")}`) : { kind: "prepared", artifacts: result };
}
