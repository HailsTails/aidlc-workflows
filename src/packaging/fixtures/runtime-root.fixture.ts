import type { PackagingRefusal } from "../domain/artifact.ts";
import type { PayloadFile } from "../domain/payload.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { FileSystem, FileWriteError } from "../../kernel/file-system-port.ts";

export const createRuntimeRootFixture = async ({ root, fileSystem }: {
  readonly root: URL;
  readonly fileSystem: Pick<FileSystem, "makeFolder" | "writeFile">;
}): Promise<Result<URL, FileWriteError>> => {
  const cli = new URL("src/cli/", root);
  const folder = await fileSystem.makeFolder({ folder: cli });
  if (!folder.ok) return folder;
  const entry = await fileSystem.writeFile({ file: new URL("main.ts", cli),
    content: { kind: "text", text: 'import { message } from "./fixture-message.ts"; console.log(message);' } });
  if (!entry.ok) return entry;
  const dependency = await fileSystem.writeFile({ file: new URL("fixture-message.ts", cli),
    content: { kind: "text", text: 'export const message = "fixture runtime";' } });
  return dependency.ok ? accepted(root) : dependency;
};

export const writeRuntimeBundleFixture = async ({ root, files, fileSystem }: {
  readonly root: URL; readonly files: readonly PayloadFile[];
  readonly fileSystem: Pick<FileSystem, "makeFolder" | "writeFile">;
}): Promise<Result<URL, FileWriteError | PackagingRefusal>> => {
  const [file] = files;
  if (file === undefined || files.length !== 1) return refused({ kind: "entry-not-bundled", entry: "fixture",
    reason: "The runtime fixture needs exactly one bundled file." });
  const destination = new URL(file.path, root);
  const folder = await fileSystem.makeFolder({ folder: new URL("./", destination) });
  return folder.ok ? fileSystem.writeFile({ file: destination, content: file.content }) : folder;
};
