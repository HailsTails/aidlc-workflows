import type { FileContent } from "../../../kernel/file-content.ts";
import type { FileSystemError, ReadFileArgs } from "../../../kernel/file-system-port.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { SourcePath } from "../../../kernel/values.ts";
import type { AuthoredHostFile } from "../../domain/host-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";

export type AuthoredFilePreparer = (file: AuthoredHostFile) => Result<AuthoredHostFile, ProjectionRefusal>;

export interface HostFileReader {
  readFile(readFileArgs: ReadFileArgs): Promise<Result<FileContent, FileSystemError>>;
}

export interface HostSurfaceReader {
  read(request: {
    readonly host: HostIdentity;
  }): Promise<Result<readonly AuthoredHostFile[], readonly ProjectionRefusal[]>>;
}

export type HostSourceCapture = {
  readonly host: HostIdentity;
  readonly root: URL;
  readonly sources: readonly SourcePath[];
  readonly required: readonly SourcePath[];
};
