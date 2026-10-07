import { baselinePath, entryDigest } from "../rin-harness-exception-baseline.ts";

const legacyBaselineFor = ({
  files,
  projectDir,
}: {
  readonly files: Readonly<Record<string, string>>;
  readonly projectDir: string;
}): Readonly<Record<string, string>> => {
  const digests = Object.entries(files).flatMap(([path, contents]) => {
    if (!path.endsWith(".json")) return [];
    try {
      const parsed: unknown = JSON.parse(contents);
      const sidecar = path.split("/").at(-1) ?? "";
      const registry = path.split("/").at(-2) ?? "";
      return Array.isArray(parsed)
        ? parsed.map((entry: unknown) =>
            entryDigest({ entry, origin: { registry, sidecar } }),
          )
        : [];
    } catch {
      return [];
    }
  });
  return {
    [baselinePath(projectDir)]: JSON.stringify({
      entryCount: digests.length,
      digests,
    }),
  };
};

export { legacyBaselineFor };
