import type { Result } from "../../../kernel/result.ts";
import type { KernelRefusal, ProjectPath } from "../../../kernel/values.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { MethodSource } from "../../../workflow-definition/domain/method-source.ts";
import type { CommandReading, CommandSubject, NativeCommandFile } from "../../domain/native-command.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";

export interface CommandSource {
  read(subject: CommandSubject): Result<CommandReading, ProjectionRefusal>;
}

export type CommandPlacement = (file: NativeCommandFile) => Result<ProjectPath, KernelRefusal>;

export type CommandSourceRequest = {
  readonly method: Method;
  readonly sources: readonly MethodSource[];
  readonly projectRoot: URL;
  readonly harnessDir: string;
  readonly harnessName: string;
};
