import type { NameList, Workspace } from "../application/ports.ts";

export const nameListFile = (request: {
  readonly workspace: Workspace;
  readonly path: string;
}): NameList => ({
  read: () => {
    const text = request.workspace.read(request.path);
    return text === undefined ? undefined : text.split(/\r?\n/).filter((line) => line !== "");
  },
  write: (names) => {
    const content = `${[...new Set(names)].sort().join("\n")}\n`;
    request.workspace.write({ path: request.path, content });
  },
});
