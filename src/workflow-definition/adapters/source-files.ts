import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sourcePath } from "../../kernel/values.ts";
import type { CapturedSourceFile, SourceFiles } from "../application/source-files.ts";

const capturedFile = async (request: {
  readonly directory: string;
  readonly within: string;
}): Promise<CapturedSourceFile> => {
  const admittedPath = sourcePath(request.within);
  if (!admittedPath.ok) throw new Error(`Unportable source path: ${request.within}`);
  const bytes = await readFile(join(request.directory, request.within));
  return { within: admittedPath.value, content: { kind: "bytes", bytes } };
};

const descendants = async (request: { readonly directory: string;
  readonly within: string }): Promise<readonly CapturedSourceFile[]> => {
  const entries = await readdir(join(request.directory, request.within), { withFileTypes: true });
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
  const directory = root instanceof URL ? fileURLToPath(root) : root;
  return { read: (sourceDirectory) => descendants({
    directory: join(directory, sourceDirectory), within: "",
  }) };
};
