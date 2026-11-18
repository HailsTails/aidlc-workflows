import { projectPath, type ProjectPath, type KernelRefusal } from "../../../kernel/values.ts";
import type { Result } from "../../../kernel/result.ts";
import type { NativeCommandFile } from "../../../projection/domain/native-command.ts";

export const claudeCommandPath = (file: NativeCommandFile): Result<ProjectPath, KernelRefusal> =>
  projectPath(`.claude/skills/${file.name}/${file.within}`);
