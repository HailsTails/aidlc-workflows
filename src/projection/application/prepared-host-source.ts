import type { FileContent } from "../../kernel/file-content.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { AuthoredHostFile } from "../domain/host-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

export const prepareHostSource = (request: {
  readonly host: HostIdentity;
  readonly file: AuthoredHostFile;
  readonly steps: readonly ((content: FileContent) => FileContent)[];
}): Result<AuthoredHostFile, ProjectionRefusal> => {
  const raw = request.file.content;
  const owned: FileContent = raw.kind === "text" ? { kind: "text", text: raw.text }
    : { kind: "bytes", bytes: new Uint8Array(raw.bytes) };
  try {
    return accepted({ source: request.file.source,
      content: request.steps.reduce((content, prepare) => prepare(content), owned) });
  } catch (error) {
    return refused({ kind: "host-source-unreadable", host: request.host,
      source: request.file.source, reason: error instanceof Error ? error.message : String(error) });
  }
};
