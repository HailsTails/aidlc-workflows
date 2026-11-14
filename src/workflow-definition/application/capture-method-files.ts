import { asFolder, type TreeSelection, type UnreadableTreeFile } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath } from "../../kernel/values.ts";
import type { AuthoredTree, MethodRefusal } from "../domain/refusals.ts";
import { methodFileKind } from "../domain/method-source.ts";
import type { AuthoredTreeReader, CapturedMethodFiles, CapturedPluginFiles,
  CapturedSourceFile, MethodReading } from "./ports.ts";

const unreadable = (request: {
  readonly tree: AuthoredTree;
  readonly within: string;
  readonly code: UnreadableTreeFile["code"];
}): MethodRefusal => ({ kind: "source-unreadable",
  location: { kind: "authored-tree", tree: request.tree, within: request.within }, code: request.code });

const captureFolder = async (request: {
  readonly reader: AuthoredTreeReader;
  readonly folder: URL;
  readonly tree: AuthoredTree;
  readonly within: string;
  readonly missing: "empty" | "refuse";
  readonly select: TreeSelection;
}): MethodReading<readonly CapturedSourceFile[]> => {
  const reading = await request.reader.readTree({ folder: request.folder, select: request.select });
  if (!reading.ok) {
    return request.missing === "empty" && reading.refusal.code === "not-found" ? accepted([])
      : refused([unreadable({ ...request, code: reading.refusal.code })]);
  }
  const failures = reading.value.unreadable.map((failure) => unreadable({ tree: request.tree,
    within: `${request.within}${failure.within}`, code: failure.code }));
  return failures.length > 0 ? refused(failures)
    : accepted(reading.value.files.map((file) => ({ within: file.path, content: file.content })));
};

const coreSelection: TreeSelection = (entry) => entry.kind === "folder"
  || (entry.kind === "file" && methodFileKind(entry.within) === "method-document") ? "read" : "skip";
const pluginSelection: TreeSelection = (entry) => entry.kind === "other" ? "skip" : "read";

const methodFolders = ["stages", "agents", "scopes", "sensors", "memory", "knowledge"] as const;

type CapturedFolder = {
  readonly folder: string;
  readonly files: readonly CapturedSourceFile[];
};

const methodGroups = (folders: readonly CapturedFolder[]): CapturedMethodFiles => {
  const markdown = (folder: string): readonly CapturedSourceFile[] =>
    (folders.find((group) => group.folder === folder)?.files ?? [])
      .filter((file) => methodFileKind(file.within) === "method-document");
  return { stages: markdown("stages"), agents: markdown("agents"), scopes: markdown("scopes"),
    sensors: markdown("sensors"), rules: markdown("memory"), knowledge: markdown("knowledge") };
};

export const captureCoreMethodFiles = async (request: {
  readonly root: URL;
  readonly reader: AuthoredTreeReader;
}): MethodReading<CapturedMethodFiles> => {
  const readings = await Promise.all(methodFolders.map(async (folder) => {
    const within = folder === "stages" ? "aidlc-common/stages" : folder;
    const files = await captureFolder({ reader: request.reader,
      folder: new URL(`${within}/`, asFolder(request.root)), tree: "core", within: `${within}/`, missing: "refuse", select: coreSelection });
    return files.ok ? accepted({ folder, files: files.value }) : files;
  }));
  const failures = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
  return failures.length > 0 ? refused(failures)
    : accepted(methodGroups(readings.flatMap((reading) => reading.ok ? [reading.value] : [])));
};

const prefixedFiles = (request: { readonly directory: string; readonly folders: readonly CapturedFolder[] }):
  Result<readonly CapturedSourceFile[], readonly MethodRefusal[]> => {
  const readings = request.folders.flatMap(({ folder, files }) => files.map((file) => {
    const within = `${folder}/${file.within}`;
    const path = sourcePath(within);
    return path.ok ? accepted({ within: path.value, content: file.content })
      : refused(unreadable({ tree: "plugins", within: `${request.directory}/${within}`, code: "unportable-name" }));
  }));
  const failures = readings.flatMap((reading) => reading.ok ? [] : [reading.refusal]);
  return failures.length > 0 ? refused(failures)
    : accepted(readings.flatMap((reading) => reading.ok ? [reading.value] : []));
};

const capturePlugin = async (request: {
  readonly root: URL;
  readonly directory: string;
  readonly reader: AuthoredTreeReader;
}): MethodReading<CapturedPluginFiles | null> => {
  const folder = new URL(`${encodeURIComponent(request.directory)}/`, asFolder(request.root));
  const manifest = await request.reader.readFile({ file: new URL(".aidlc-plugin/plugin.json", folder) });
  if (!manifest.ok) return manifest.refusal.code === "not-found" ? accepted(null)
    : refused([unreadable({ tree: "plugins", within: `${request.directory}/.aidlc-plugin/plugin.json`,
      code: manifest.refusal.code })]);
  const readings = await Promise.all([...methodFolders, "contributions", "tools"]
    .map(async (name) => {
      const files = await captureFolder({ reader: request.reader, folder: new URL(`${name}/`, folder),
        tree: "plugins", within: `${request.directory}/${name}/`, missing: "empty", select: pluginSelection });
      return files.ok ? accepted({ folder: name, files: files.value }) : files;
    }));
  const failures = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
  if (failures.length > 0) return refused(failures);
  const folders = readings.flatMap((reading) => reading.ok ? [reading.value] : []);
  const files = prefixedFiles({ directory: request.directory, folders });
  if (!files.ok) return files;
  const path = sourcePath(".aidlc-plugin/plugin.json");
  if (!path.ok) return refused([unreadable({ tree: "plugins", within: request.directory,
    code: "unportable-name" })]);
  return accepted({ directory: request.directory, manifest: { within: path.value, content: manifest.value },
    files: files.value, methodFiles: methodGroups(folders) });
};

export const capturePluginMethodFiles = async (request: {
  readonly root: URL;
  readonly reader: AuthoredTreeReader;
}): MethodReading<readonly CapturedPluginFiles[]> => {
  const listed = await request.reader.listFolder({ folder: asFolder(request.root) });
  if (!listed.ok) return listed.refusal.code === "not-found" ? accepted([])
    : refused([unreadable({ tree: "plugins", within: "", code: listed.refusal.code })]);
  const folders = listed.value.filter((entry) => entry.kind === "folder")
    .toSorted((left, right) => left.name < right.name ? -1 : Number(left.name > right.name));
  const readings = await Promise.all(folders.map((entry) => capturePlugin({ ...request, directory: entry.name })));
  const failures = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
  return failures.length > 0 ? refused(failures) : accepted(readings.flatMap((reading) =>
    reading.ok && reading.value !== null ? [reading.value] : []));
};
