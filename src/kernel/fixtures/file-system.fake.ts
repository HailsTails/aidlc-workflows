import {
  asFolder,
  walkTree,
  type FileSystem,
  type FileSystemFault,
  type FolderEntry,
  type TreeSelection,
} from "../file-system-port.ts";
import type { FileContent, FileMode } from "../file-content.ts";
import { accepted, refused } from "../result.ts";

export type InMemoryFileSystemArgs = {
  readonly files: Readonly<Record<string, string | Uint8Array>>;
  readonly faults?: Readonly<Record<string, FileSystemFault>>;
  readonly others?: readonly string[];
};

export type InMemoryFileSystem = FileSystem & {
  readonly snapshot: () => Readonly<Record<string, FileContent>>;
  readonly modes: () => Readonly<Record<string, FileMode>>;
};

type Store = {
  readonly files: Map<string, FileContent>;
  readonly modes: Map<string, FileMode>;
  readonly folders: Set<string>;
  readonly faults: Readonly<Record<string, FileSystemFault>>;
  readonly others: readonly string[];
};

const contentOf = (content: string | Uint8Array): FileContent =>
  ({ kind: "bytes", bytes: typeof content === "string" ? new TextEncoder().encode(content) : content });

const entriesBelow = (store: Store, folder: string): readonly FolderEntry[] => {
  const hrefs = [...store.files.keys(), ...store.folders, ...Object.keys(store.faults), ...store.others];
  const entries = hrefs.filter((href) => href.startsWith(folder) && href !== folder)
    .map((href): FolderEntry => {
      const remainder = href.slice(folder.length);
      const [segment = ""] = remainder.split("/");
      const name = decodeURIComponent(segment);
      if (remainder.includes("/")) return { name, kind: "folder" };
      return { name, kind: store.others.includes(href) ? "other" : "file" };
    });
  return [...new Map(entries.map((entry) => [entry.name, entry])).values()];
};

const readsOf = (store: Store): Pick<FileSystem, "readFile" | "listFolder"> => ({
  readFile: async ({ file }) => {
    const fault = store.faults[file.href];
    if (fault !== undefined) return refused({ kind: "unreadable", code: fault });
    const content = store.files.get(file.href);
    return content === undefined ? refused({ kind: "unreadable", code: "not-found" }) : accepted(content);
  },
  listFolder: async ({ folder }) => {
    const fault = store.faults[folder.href];
    if (fault !== undefined) return refused({ kind: "unreadable", code: fault });
    const entries = entriesBelow(store, folder.href);
    const known = entries.length > 0 || store.folders.has(folder.href);
    return known ? accepted(entries) : refused({ kind: "unreadable", code: "not-found" });
  },
});

const writesOf = (store: Store): Pick<FileSystem,
  "makeScratchFolder" | "makeFolder" | "writeFile" | "removeFolder"> => ({
  makeScratchFolder: async ({ parent }) => {
    const scratch = new URL(`scratch-${store.folders.size + 1}/`, asFolder(parent));
    store.folders.add(scratch.href);
    return accepted(scratch);
  },
  makeFolder: async ({ folder }) => {
    store.folders.add(asFolder(folder).href);
    return accepted(asFolder(folder));
  },
  writeFile: async ({ file, content, mode = "regular" }) => {
    const fault = store.faults[file.href];
    if (fault !== undefined) return refused({ kind: "unwritable", code: fault });
    store.files.set(file.href, content);
    store.modes.set(file.href, mode);
    return accepted(file);
  },
  removeFolder: async ({ folder }) => {
    const prefix = asFolder(folder).href;
    [...store.files.keys()].filter((href) => href.startsWith(prefix)).forEach((href) => {
      store.files.delete(href);
    });
    [...store.folders].filter((href) => href.startsWith(prefix)).forEach((href) => {
      store.folders.delete(href);
    });
    return accepted(asFolder(folder));
  },
});

export const createInMemoryFileSystem = (
  { files, faults = {}, others = [] }: InMemoryFileSystemArgs,
): InMemoryFileSystem => {
  const store: Store = {
    files: new Map(Object.entries(files).map(([href, content]) => [href, contentOf(content)])),
    modes: new Map(), folders: new Set(), faults, others,
  };
  const reads = readsOf(store);
  return {
    ...reads,
    ...writesOf(store),
    readTree: ({ folder, select }) => walkTree({ fileSystem: reads, folder, select }),
    snapshot: () => Object.fromEntries(store.files),
    modes: () => Object.fromEntries(store.modes),
  };
};

export const selectFoldersAndFiles = ({ files }: { readonly files: readonly string[] }): TreeSelection =>
  (entry) => entry.kind === "folder" || files.includes(entry.within) ? "read" : "skip";
