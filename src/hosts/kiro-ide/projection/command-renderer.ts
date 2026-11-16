import { projectPath, type ProjectPath, type KernelRefusal } from "../../../kernel/values.ts";
import type { Result } from "../../../kernel/result.ts";
import type { NativeCommandFile } from "../../../projection/domain/native-command.ts";

export const kiroIdeCommandPath = (file: NativeCommandFile): Result<ProjectPath, KernelRefusal> =>
  projectPath(`.kiro/skills/${file.name}/${file.within}`);
