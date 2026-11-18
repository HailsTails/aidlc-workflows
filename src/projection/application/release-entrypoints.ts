import type { FileSystem } from "../../kernel/file-system-port.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { sourcePath, type KernelRefusal } from "../../kernel/values.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

export const captureReleaseEntrypoints = async (request: {
  readonly core: URL; readonly reader: Pick<FileSystem, "listFolder">;
}) => {
  const listings = await Promise.all(["hooks", "tools"].map(async (folder) => {
    const source = sourcePath(folder);
    if (!source.ok) return refused([source.refusal]);
    const reading = await request.reader.listFolder({ folder: new URL(`${folder}/`, request.core) });
    return reading.ok ? accepted(reading.value.filter((entry) => entry.kind === "file" && entry.name.endsWith(".ts"))
      .map((entry) => sourcePath(`${folder}/${entry.name}`))) : refused([{ kind: "neutral-source-unreadable" as const,
      source: source.value, reason: reading.refusal.code }]);
  }));
  const failures = listings.flatMap<KernelRefusal | ProjectionRefusal>((reading) => reading.ok ? [] : reading.refusal);
  if (failures.length > 0) return refused(failures);
  const paths = listings.flatMap((reading) => reading.ok ? reading.value : []);
  const invalid = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
  return invalid.length > 0 ? refused(invalid) : accepted(paths.flatMap((path) => path.ok ? [path.value] : []).sort());
};
