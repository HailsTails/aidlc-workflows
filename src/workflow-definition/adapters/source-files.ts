import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sourcePath } from "../../kernel/values.ts";
import type { CapturedSourceFile, SourceFiles } from "../application/source-files.ts";

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
  readonly within: string }): Promise<readonly CapturedSourceFile[]> => {
  const entries = await readdir(sourceLocation(request.directory, request.within), { withFileTypes: true });
  const captured = await Promise.all(entries.map(async (entry) => {
    const within = request.within ? `${request.within}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return descendants({ directory: request.directory, within });
    if (entry.isFile() && entry.name.endsWith(".md")) {
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
