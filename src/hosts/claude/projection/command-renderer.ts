import type { NativeCommandFile } from "../../../projection/application/ports.ts";

export const claudeCommandPath = (file: NativeCommandFile): string =>
  `.claude/skills/${file.nativeName}/${file.within}`;
