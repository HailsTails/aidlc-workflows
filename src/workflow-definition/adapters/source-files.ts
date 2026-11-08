import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sourcePath } from "../../kernel/values.ts";
import type { CapturedPluginFiles, CapturedSourceFile, SourceFiles } from "../application/source-files.ts";

const sourceLocation = (directory: string | URL, within: string): string | URL =>
  directory instanceof URL
    ? new URL(within.split("/").map((segment) => encodeURIComponent(segment)).join("/"), directory)
    : join(directory, within);
const capturedFile = async (request: {
  readonly directory: string | URL;
  readonly within: string;
}): Promise<CapturedSourceFile> => {
  const admittedPath = sourcePath(request.within);
  if (!admittedPath.ok) throw new Error(`Unportable source path: ${request.within}`);
  const bytes = await readFile(sourceLocation(request.directory, request.within));
  return { within: admittedPath.value, content: { kind: "bytes", bytes } };
};

const descendants = async (request: { readonly directory: string | URL;
  readonly within: string; readonly files?: "markdown" | "all" }): Promise<readonly CapturedSourceFile[]> => {
  const entries = await readdir(sourceLocation(request.directory, request.within), { withFileTypes: true });
  const captured = await Promise.all(entries.map(async (entry) => {
    const within = request.within ? `${request.within}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return descendants({ directory: request.directory, within, files: request.files ?? "markdown" });
    if (entry.isFile() && (request.files === "all" || entry.name.endsWith(".md"))) {
      return [await capturedFile({ directory: request.directory, within })];
    }
    return [];
  }));
  return captured.flat().toSorted((left, right) =>
    left.within < right.within ? -1 : Number(left.within > right.within));
};

export const createSourceFiles = (root: string | URL): SourceFiles => {
  const directoryRoot = root instanceof URL ? new URL(root.href) : root;
  if (directoryRoot instanceof URL && !directoryRoot.pathname.endsWith("/")) {
    directoryRoot.pathname += "/";
  }
  return { read: (sourceDirectory) => descendants({
    directory: sourceLocation(directoryRoot, `${sourceDirectory}/`), within: "",
  }) };
};

const pluginFolders = ["stages", "agents", "scopes", "sensors", "memory", "knowledge",
  "contributions", "tools"] as const;

const optionalPluginFiles = async (root: string | URL, folder: string):
  Promise<readonly CapturedSourceFile[]> => {
  try {
    return await descendants({ directory: root, within: folder, files: "all" });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const capturePlugin = async (root: string | URL, directory: string):
  Promise<CapturedPluginFiles | null> => {
  const pluginRoot = sourceLocation(root, `${directory}/`);
  let manifest: CapturedSourceFile;
  try {
    manifest = await capturedFile({ directory: pluginRoot, within: ".aidlc-plugin/plugin.json" });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
  const groups = await Promise.all(pluginFolders.map((folder) =>
    optionalPluginFiles(pluginRoot, folder)));
  return { directory, manifest, files: groups.flat() };
};

export const captureRepositoryPlugins = async (root: string | URL):
  Promise<readonly CapturedPluginFiles[]> => {
  const entries = await readdir(root, { withFileTypes: true }).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  const captured = await Promise.all(entries.filter((entry) => entry.isDirectory())
    .map((entry) => capturePlugin(root, entry.name)));
  return captured.filter((plugin) => plugin !== null).toSorted((left, right) =>
    left.directory < right.directory ? -1 : Number(left.directory > right.directory));
};
