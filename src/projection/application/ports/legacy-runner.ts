import type {
  FileSystemError,
  FileWriteError,
  MakeFolderArgs,
  MakeScratchFolderArgs,
  ReadTreeArgs,
  RemoveFolderArgs,
  TreeReading,
  WriteFileArgs,
} from "../../../kernel/file-system-port.ts";
import type {
  ProcessFailure,
  ProcessOutput,
  RunCurrentRuntimeArgs,
} from "../../../kernel/process-runner-port.ts";
import type { Result } from "../../../kernel/result.ts";

export interface LegacyRunnerScratch {
  makeScratchFolder(makeScratchFolderArgs: MakeScratchFolderArgs): Promise<Result<URL, FileWriteError>>;
  makeFolder(makeFolderArgs: MakeFolderArgs): Promise<Result<URL, FileWriteError>>;
  writeFile(writeFileArgs: WriteFileArgs): Promise<Result<URL, FileWriteError>>;
  removeFolder(removeFolderArgs: RemoveFolderArgs): Promise<Result<URL, FileWriteError>>;
}

export interface LegacyRunnerProcess {
  runCurrentRuntime(
    runCurrentRuntimeArgs: RunCurrentRuntimeArgs,
  ): Promise<Result<ProcessOutput, ProcessFailure>>;
}

export interface LegacyRunnerOutputReader {
  readTree(readTreeArgs: ReadTreeArgs): Promise<Result<TreeReading, FileSystemError>>;
}
