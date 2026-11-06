type DirectoryEntry = { name: string; kind: "directory" | "file" | "other" };
export type TestDirectoryReader = (request: { directory: string }) => readonly DirectoryEntry[] | null;

const sourceRoots = ["core", "harness", "scripts"];
const excludedDirectories = new Set([
  "node_modules", ".git", "dist", "dist-release", "build", "coverage", "vendor",
  "fixtures", "test-fixtures", "__fixtures__",
]);
const testExtension = /\.test\.ts$/;
const normalized = ({ path }: { path: string }): string => path.replaceAll("\\", "/").replace(/\/$/, "");

export function discoverCoLocatedTests({ repositoryRoot, readDirectory }: {
  repositoryRoot: string;
  readDirectory: TestDirectoryReader;
}): string[] {
  const visit = ({ directory }: { directory: string }): string[] =>
    (readDirectory({ directory }) ?? []).flatMap((entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.kind === "directory") return excludedDirectories.has(entry.name) ? [] : visit({ directory: path });
      return entry.kind === "file" && testExtension.test(entry.name) ? [path] : [];
    });
  return sourceRoots.flatMap((root) => visit({ directory: `${normalized({ path: repositoryRoot })}/${root}` })).sort();
}

export function discoverUnitTests({ repositoryRoot, readDirectory }: {
  repositoryRoot: string;
  readDirectory: TestDirectoryReader;
}): string[] {
  const directory = `${normalized({ path: repositoryRoot })}/tests/unit`;
  const tierTests = (readDirectory({ directory }) ?? [])
    .filter((entry) => entry.kind === "file" && entry.name.endsWith(".test.ts"))
    .map((entry) => `${directory}/${entry.name}`).sort();
  return [...tierTests, ...discoverCoLocatedTests({ repositoryRoot, readDirectory })];
}

export function coLocatedTestKey({ repositoryRoot, file }: { repositoryRoot: string; file: string }): string | null {
  const prefix = `${normalized({ path: repositoryRoot })}/`;
  const path = normalized({ path: file });
  if (!path.startsWith(prefix)) return null;
  const relative = path.slice(prefix.length);
  if (!testExtension.test(relative) || !sourceRoots.some((root) => relative.startsWith(`${root}/`))) return null;
  return `source-${encodeURIComponent(relative)}`;
}

export function unitTestKey({ repositoryRoot, file }: { repositoryRoot: string; file: string }): string {
  return coLocatedTestKey({ repositoryRoot, file }) ?? normalized({ path: file }).split("/").at(-1) ?? file;
}
