import { asFolder, readEveryEntry, type FileSystem } from "../../kernel/file-system-port.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { OutputTrees } from "../application/ports.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { Payload } from "../domain/payload.ts";
import { writePayloadTree } from "./payload-tree-writer.ts";

const failure = (request: {
  readonly operation: "list" | "remove" | "write" | "scratch" | "read";
  readonly location: URL;
  readonly reason: string;
}): PackagingRefusal => ({ kind: "output-tree-failed", operation: request.operation,
  path: request.location.href, reason: request.reason });

export const createOutputTrees = (binding: {
  readonly root: URL;
  readonly scratchParent: URL;
  readonly fileSystem: FileSystem;
  readonly written: (hostPayload: Payload) => void;
}): OutputTrees => ({
  root: asFolder(binding.root),
  list: async (folder) => {
    const reading = await binding.fileSystem.listFolder({ folder });
    if (reading.ok) return accepted(reading.value.map((entry) => entry.name));
    return reading.refusal.code === "not-found" ? accepted([])
      : refused(failure({ operation: "list", location: folder, reason: reading.refusal.code }));
  },
  remove: async (entry) => {
    const removed = await binding.fileSystem.removeEntry({ entry });
    return removed.ok || removed.refusal.code === "not-found" ? accepted(entry)
      : refused(failure({ operation: "remove", location: entry, reason: removed.refusal.code }));
  },
  writePayload: async ({ root, payload: hostPayload }) => {
    const written = await writePayloadTree({ root, payload: hostPayload, fileSystem: binding.fileSystem });
    if (!written.ok) return refused(failure({ operation: "write", location: root, reason: written.refusal.code }));
    binding.written(hostPayload);
    return written;
  },
  scratch: async () => {
    const created = await binding.fileSystem.makeScratchFolder({ parent: binding.scratchParent });
    return created.ok ? created
      : refused(failure({ operation: "scratch", location: binding.scratchParent, reason: created.refusal.code }));
  },
  read: async (folder) => {
    const reading = await binding.fileSystem.readTree({ folder, select: readEveryEntry });
    if (!reading.ok) return reading.refusal.code === "not-found" ? accepted([])
      : refused(failure({ operation: "read", location: folder, reason: reading.refusal.code }));
    const unreadable = reading.value.unreadable[0];
    return unreadable ? refused(failure({ operation: "read", location: folder,
      reason: `${unreadable.within}: ${unreadable.code}` })) : accepted(reading.value.files);
  },
});
