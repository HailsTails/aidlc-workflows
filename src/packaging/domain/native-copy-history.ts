import type { ContentHash } from "../../kernel/values.ts";
import { DEFAULT_WORKSPACE } from "../../projection/domain/workspace.ts";
import type { Payload } from "./payload.ts";
import { payloadTreeOrder } from "./payload-files.ts";

export const managedPayloadDirectories = (releasePayload: Payload): readonly string[] => {
  const roots = new Set(releasePayload.descriptor.layout.rootIntegrations.map((root) => root.path));
  const directories = [...new Set(releasePayload.files.filter((file) => file.path.includes("/"))
    .map((file) => file.path.split("/")[0] ?? ""))];
  return directories.filter((directory) => !releasePayload.files.filter((file) => file.path.startsWith(`${directory}/`))
    .every((file) => roots.has(file.path))).sort();
};

type NativeCopyHistory = {
  readonly legacyManagedFileHashes: Readonly<Record<string, readonly ContentHash[]>>;
  readonly retiredCopyFileHashes: Readonly<Record<string, readonly ContentHash[]>>;
};

const changedCopySignatures = ({ native, copy, directories }: {
  readonly native: Payload; readonly copy: Payload; readonly directories: readonly string[];
}): Record<string, readonly ContentHash[]> => {
  const copied = new Map(copy.files.map((file) => [file.path, file]));
  return Object.fromEntries<readonly ContentHash[]>(directories.flatMap((directory) => native.files
    .filter((file) => file.path.startsWith(`${directory}/`)).toSorted(payloadTreeOrder).flatMap((file) => {
      const previous = copied.get(file.path);
      return previous && previous.hash !== file.hash ? [[file.path, [previous.hash]]] : [];
    })));
};

const copyEraSignatures = ({ native, directories, changed }: {
  readonly native: Payload; readonly directories: readonly string[];
  readonly changed: Readonly<Record<string, readonly ContentHash[]>>;
}): NativeCopyHistory => {
  const current = new Map(native.files.map((file) => [file.path, file]));
  const workspace = DEFAULT_WORKSPACE.activeSpace.slice(0, DEFAULT_WORKSPACE.activeSpace.indexOf("/") + 1);
  return native.descriptor.history.retiredFiles.filter((historical) => directories
    .some((directory) => historical.path.startsWith(`${directory}/`)) && !historical.path.startsWith(workspace))
    .reduce<NativeCopyHistory>((history, historical) => {
      const file = current.get(historical.path);
      if (!file) return { ...history, retiredCopyFileHashes: { ...history.retiredCopyFileHashes,
        [historical.path]: historical.shippedHashes.toSorted() } };
      const known = [...new Set([...(history.legacyManagedFileHashes[historical.path] ?? []),
        ...historical.shippedHashes.filter((hash) => hash !== file.hash)])].sort();
      return known.length > 0 ? { ...history, legacyManagedFileHashes: { ...history.legacyManagedFileHashes,
        [historical.path]: known } } : history;
    }, { legacyManagedFileHashes: { ...changed }, retiredCopyFileHashes: {} });
};

export const nativeCopyHistory = ({ native, copy }: { readonly native: Payload; readonly copy: Payload }): NativeCopyHistory => {
  const directories = managedPayloadDirectories(native);
  const changed = changedCopySignatures({ native, copy, directories });
  const history = copyEraSignatures({ native, directories, changed });
  const descriptorPath = `${native.descriptor.host.directory}/tools/data/aidlc-projection.json`;
  const descriptor = copy.files.find((file) => file.path === descriptorPath);
  return { legacyManagedFileHashes: { ...history.legacyManagedFileHashes,
    ...(descriptor ? { [descriptor.path]: [descriptor.hash] } : {}) },
  retiredCopyFileHashes: history.retiredCopyFileHashes };
};
