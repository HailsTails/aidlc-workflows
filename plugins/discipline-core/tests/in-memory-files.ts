import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { EntryDisposition } from "../scripts/install-proof-plan.ts";
import type { CopiedEntry, ListedEntry, ScratchFilesPort } from "../scripts/install-proof-ports.ts";

export type InMemoryFiles = {
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly texts: () => Readonly<Record<string, string>>;
  readonly pathsUnder: (request: { readonly folder: string }) => readonly string[];
  readonly textsUnder: (request: { readonly folder: string }) => Readonly<Record<string, string>>;
};

type Placement = "inside" | "outside";

const placementOf = (request: { readonly path: string; readonly folder: string }): Placement =>
  request.path === request.folder || request.path.startsWith(`${request.folder}/`) ? "inside" : "outside";

const copyDispositionOf = (request: {
  readonly relative: string;
  readonly disposition: (entry: CopiedEntry) => EntryDisposition;
}): EntryDisposition => {
  const segments = request.relative.split("/");
  return segments.every(
    (name, index) => request.disposition({ name, entryKind: index === segments.length - 1 ? "file" : "folder" }) === "kept",
  )
    ? "kept"
    : "left-out";
};

const copiedInto = (request: {
  readonly files: ReadonlyMap<string, string>;
  readonly from: string;
  readonly to: string;
  readonly disposition: (entry: CopiedEntry) => EntryDisposition;
}): readonly (readonly [string, string])[] =>
  [...request.files.entries()]
    .filter(
      ([candidate]) =>
        placementOf({ path: candidate, folder: request.from }) === "inside" &&
        copyDispositionOf({ relative: candidate.slice(request.from.length + 1), disposition: request.disposition }) === "kept",
    )
    .map(([path, text]): readonly [string, string] => [`${request.to}${path.slice(request.from.length)}`, text]);

const listedUnder = (request: { readonly files: ReadonlyMap<string, string>; readonly folder: string }): readonly ListedEntry[] =>
  [...request.files.keys()]
    .filter((path) => path.startsWith(`${request.folder}/`))
    .sort()
    .map((path) => ({
      path: path.slice(request.folder.length + 1),
      name: path.slice(path.lastIndexOf("/") + 1),
      entryKind: "file",
    }));

export const inMemoryFiles = (request: { readonly initial: Readonly<Record<string, string>> }): InMemoryFiles => {
  const files = new Map(Object.entries(request.initial));
  const temporaryRoots = { created: 0 };
  return {
    texts: () => Object.fromEntries(files),
    pathsUnder: ({ folder }) => listedUnder({ files, folder }).map((entry) => entry.path),
    textsUnder: ({ folder }) => Object.fromEntries([...files.entries()].filter(([path]) => path.startsWith(`${folder}/`))),
    fileText: {
      read: ({ path }) => {
        const text = files.get(path);
        return text === undefined
          ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } }
          : { outcome: "ok", value: text };
      },
      exists: ({ path }) => (files.has(path) ? "present" : "absent"),
      write: ({ path, text }) => {
        files.set(path, text);
        return { outcome: "ok", value: undefined };
      },
    },
    scratch: {
      createTemporaryDirectory: ({ prefix }) => {
        temporaryRoots.created += 1;
        return { outcome: "ok", value: `/tmp/${prefix}${temporaryRoots.created}` };
      },
      removeTree: ({ path }) => {
        [...files.keys()]
          .filter((candidate) => placementOf({ path: candidate, folder: path }) === "inside")
          .forEach((key) => {
            files.delete(key);
          });
        return { outcome: "ok", value: null };
      },
      removeFile: ({ path }) => {
        files.delete(path);
        return { outcome: "ok", value: null };
      },
      makeDirectory: () => ({ outcome: "ok", value: null }),
      copyTree: ({ from, to, disposition }) => {
        copiedInto({ files, from, to, disposition }).forEach(([path, text]) => {
          files.set(path, text);
        });
        return { outcome: "ok", value: null };
      },
      listTree: ({ path }) => ({ outcome: "ok", value: listedUnder({ files, folder: path }) }),
      digestOf: ({ path }) => {
        const text = files.get(path);
        return text === undefined
          ? { outcome: "failed", error: { kind: "effect-failed", detail: `ENOENT ${path}` } }
          : { outcome: "ok", value: `digest of ${text}` };
      },
    },
  };
};
