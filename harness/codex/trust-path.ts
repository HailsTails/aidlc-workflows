import { posix, win32 } from "node:path";

// Explicit paths are Codex identities, not paths for this machine to resolve.
// Defaults follow the installer's spelling even on a different host platform.
export const codexTrustPath = ({ projectDir, hooksJsonPath, harnessDir }: { readonly projectDir: string; readonly hooksJsonPath?: string | undefined; readonly harnessDir: string }): string => {
  const projectPath = win32.isAbsolute(projectDir) && (!posix.isAbsolute(projectDir) || projectDir.startsWith("//")) ? win32 : posix;
  return hooksJsonPath ?? projectPath.join(projectDir, harnessDir, "hooks.json");
};
