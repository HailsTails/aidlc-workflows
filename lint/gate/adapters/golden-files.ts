import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { goldenGroupOf, type GoldenManifest, type GoldenSet } from "../domain/golden.ts";
import type { GoldenSource, GoldenStore, Workspace } from "../application/ports.ts";

export type GoldenLayout = {
  readonly root: string;
  readonly outputRoots: readonly string[];
  readonly harnesses: () => readonly string[];
  readonly storeDirectory: string;
};

const GoldenFileSchema = z.object({
  schemaVersion: z.literal(1),
  harness: z.string().min(1),
  files: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
});

const filesUnder = (root: string, directory: string): readonly string[] => {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) {
    return [];
  }
  const relativePath = (entry: Dirent): string =>
    join(entry.parentPath, entry.name).slice(root.length + 1).replaceAll("\\", "/");
  return readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(relativePath);
};

const sha256 = (root: string, path: string): string =>
  new Bun.CryptoHasher("sha256").update(readFileSync(join(root, path))).digest("hex");

const sortedManifest = (entries: readonly (readonly [string, string])[]): GoldenManifest =>
  Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));

export const goldenSource = (layout: GoldenLayout): GoldenSource => ({
  measure: () => {
    const harnesses = layout.harnesses();
    const grouped: Record<string, (readonly [string, string])[]> = {};
    const paths = layout.outputRoots.flatMap((directory) => filesUnder(layout.root, directory));
    for (const path of paths) {
      const group = goldenGroupOf({ path, harnesses });
      if (group !== undefined) {
        grouped[group] = [...(grouped[group] ?? []), [path, sha256(layout.root, path)]];
      }
    }
    return Object.fromEntries(
      Object.entries(grouped).map(([group, entries]) => [group, sortedManifest(entries)]),
    );
  },
});

const storePath = (layout: GoldenLayout, harness: string): string =>
  `${layout.storeDirectory}/${harness}.json`;

export const goldenStore = (request: {
  readonly layout: GoldenLayout;
  readonly workspace: Workspace;
}): GoldenStore => {
  const { layout, workspace } = request;
  return {
    read: (): GoldenSet => {
      const entries = layout.harnesses().flatMap((harness) => {
        const text = workspace.read(storePath(layout, harness));
        const manifest = text === undefined ? undefined : GoldenFileSchema.parse(JSON.parse(text));
        return manifest === undefined ? [] : [[harness, manifest.files] as const];
      });
      return Object.fromEntries(entries);
    },
    write: (set) => {
      for (const [harness, files] of Object.entries(set)) {
        const content = `${JSON.stringify({ schemaVersion: 1, harness, files }, null, 2)}\n`;
        workspace.write({ path: storePath(layout, harness), content });
      }
    },
  };
};
