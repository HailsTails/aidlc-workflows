import { asFolder, readEveryEntry, type TreeReading } from "../../kernel/file-system-port.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { sourcePath, type SourcePath } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { RUNTIME_FOLDERS, type RuntimeFile } from "../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { RuntimeReading, SessionSkillTreeReader } from "../application/ports.ts";

const copiedContent = (content: FileContent): FileContent => content.kind === "text" ? content
  : { kind: "bytes", bytes: new Uint8Array(content.bytes) };
const unreadable = (source: SourcePath, reason: string): ProjectionRefusal =>
  ({ kind: "neutral-source-unreadable", source, reason });

type FolderCapture = { readonly files: readonly RuntimeFile[]; readonly failures: readonly ProjectionRefusal[] };
const capturedFolder = (folder: typeof RUNTIME_FOLDERS[number], reading: TreeReading): FolderCapture => {
  const root = sourcePath(folder);
  if (!root.ok) return { files: [], failures: [{ kind: "render-failed", concept: "host-data",
    name: folder, reason: "The runtime folder is not a portable source path." }] };
  const files = reading.files.map((file) => ({ file, path: sourcePath(`${folder}/${file.path}`) }));
  return {
    files: files.flatMap(({ file, path }) => path.ok
      ? [{ source: path.value, content: copiedContent(file.content) }] : []),
    failures: [
      ...reading.unreadable.map((failure) => {
        const raw = `${folder}/${failure.within}`.replace(/\/$/, "");
        const path = sourcePath(raw);
        return unreadable(path.ok ? path.value : root.value,
          path.ok ? failure.code : `${failure.code}: ${raw}`);
      }),
      ...files.flatMap(({ path }) => path.ok ? [] : [unreadable(root.value, path.refusal.raw)]),
    ],
  };
};

type RuntimeCapturePorts = {
  readonly tree: SessionSkillTreeReader;
  readonly agentTiers: (method: Method) => FileContent;
  readonly settingsSchema: () => FileContent;
};
export const createRuntimeReading = (ports: RuntimeCapturePorts): RuntimeReading => async (capture) => {
  const folders = await Promise.all(RUNTIME_FOLDERS.map(async (folder): Promise<FolderCapture> => {
    const reading = await ports.tree.readTree({ folder: new URL(`${folder}/`, asFolder(capture.core)),
      select: readEveryEntry });
    if (reading.ok) return capturedFolder(folder, reading.value);
    const source = sourcePath(folder);
    return { files: [], failures: [source.ok ? unreadable(source.value, reading.refusal.code)
      : { kind: "render-failed", concept: "host-data", name: folder, reason: reading.refusal.code }] };
  }));
  const failures = folders.flatMap((folder) => folder.failures);
  if (failures.length > 0) return refused(failures);
  const files = folders.flatMap((folder) => folder.files);
  const version = files.find((file) => file.source === "tools/aidlc-version.ts");
  if (!version) {
    const source = sourcePath("tools/aidlc-version.ts");
    return refused([source.ok ? unreadable(source.value, "not-found")
      : { kind: "render-failed", concept: "host-data", name: "aidlc-version.ts", reason: "not-found" }]);
  }
  const stamped = capture.stamp(version.content);
  return stamped.ok ? accepted({ files: files.filter((file) => file !== version), version: stamped.value,
    agentTiers: ports.agentTiers(capture.method), settingsSchema: ports.settingsSchema() })
    : refused([stamped.refusal]);
};
