import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Workspace } from "../application/ports.ts";

const toPosix = (path: string): string => path.replaceAll("\\", "/");

export const fileWorkspace = (root: string): Workspace => ({
  read: (path) => {
    const absolute = join(root, path);
    return existsSync(absolute) && statSync(absolute).isFile()
      ? readFileSync(absolute, "utf8")
      : undefined;
  },
  write: ({ path, content }) => {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  },
  filesMatching: (globs) => {
    const found = globs.flatMap((glob) => [
      ...new Bun.Glob(glob).scanSync({ cwd: root, onlyFiles: true, dot: true }),
    ]);
    return [...new Set(found.map(toPosix))].sort();
  },
});
