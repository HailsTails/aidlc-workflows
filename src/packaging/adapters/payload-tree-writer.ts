import { asFolder, type FileSystem, type FileWriteError } from "../../kernel/file-system-port.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import type { Payload } from "../domain/payload.ts";

export const writePayloadTree = async ({ root, payload: releasePayload, fileSystem }: {
  readonly root: URL;
  readonly payload: Payload;
  readonly fileSystem: Pick<FileSystem, "removeFolder" | "makeFolder" | "writeFile">;
}): Promise<Result<URL, FileWriteError>> => {
  const folder = asFolder(root);
  const removed = await fileSystem.removeFolder({ folder });
  if (!removed.ok) return removed;
  const created = await fileSystem.makeFolder({ folder });
  if (!created.ok) return created;
  return releasePayload.files.reduce<Promise<Result<URL, FileWriteError>>>(async (previous, file) => {
    const completed = await previous;
    if (!completed.ok) return completed;
    const encoded = file.path.split("/").map(encodeURIComponent).join("/");
    const destination = new URL(encoded, folder);
    const parent = await fileSystem.makeFolder({ folder: new URL("./", destination) });
    if (!parent.ok) return parent;
    const written = await fileSystem.writeFile({ file: destination, content: file.content, mode: file.mode });
    return written.ok ? accepted(folder) : written;
  }, Promise.resolve(created));
};
