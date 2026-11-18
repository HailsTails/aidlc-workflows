import { projectPath, type ProjectPath, type KernelRefusal } from "../../../kernel/values.ts";
import type { Result } from "../../../kernel/result.ts";
import type { NativeCommandFile } from "../../../projection/domain/native-command.ts";

export const codexCommandPath = (file: NativeCommandFile): Result<ProjectPath, KernelRefusal> =>
  projectPath(`.agents/skills/${file.name}/${file.within}`);
