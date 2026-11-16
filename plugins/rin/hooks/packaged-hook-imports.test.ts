import { describe, expect, test } from "vitest";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort, defaultSidecarFileReader } from "../tools/rin-harness-sidecar-file-reader.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();
const directories = defaultSidecarFileReader();

const pluginRoot = paths.resolve({
  segments: [paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }), ".."],
});
const repositoryRoot = paths.resolve({ segments: [pluginRoot, "..", ".."] });
const packagedPluginRoot = paths.join({ segments: [repositoryRoot, "dist", "plugins", "rin"] });

const RELATIVE_SPECIFIER = /(?:from\s+|import\s+|import\(\s*)"(\.{1,2}\/[^"]+)"/g;
const FOLLOWED_SOURCE = /\.(?:ts|mjs|js)$/;

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

const hookFilesOf = (registrations: unknown): readonly string[] =>
  Array.isArray(registrations)
    ? registrations.flatMap((registration: unknown) => {
        const hookFile = recordOf(registration)["hookFile"];
        return typeof hookFile === "string" && !hookFile.includes("/") ? [hookFile] : [];
      })
    : [];

const registeredHookFilesByHarness = (): ReadonlyMap<string, readonly string[]> => {
  const manifest: unknown = JSON.parse(
    files.read(paths.join({ segments: [pluginRoot, ".aidlc-plugin", "plugin.json"] })),
  );
  const hooks = recordOf(recordOf(recordOf(manifest)["aidlc"])["hooks"]);
  return new Map(
    Object.entries(hooks).map(([harness, registrations]) => [harness, [...new Set(hookFilesOf(registrations))]]),
  );
};

const relativeSpecifiersOf = ({ source }: { readonly source: string }): readonly string[] =>
  [...source.matchAll(RELATIVE_SPECIFIER)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));

const unresolvedImportsFrom = ({
  entry,
  visited,
}: {
  readonly entry: string;
  readonly visited: Set<string>;
}): readonly string[] => {
  if (visited.has(entry)) return [];
  visited.add(entry);
  const directory = paths.dirname({ path: entry });
  return relativeSpecifiersOf({ source: files.read(entry) }).flatMap((specifier) => {
    const target = paths.resolve({ segments: [directory, specifier] });
    if (!files.exists(target)) return [`${paths.basename({ path: entry })} -> ${specifier}`];
    return FOLLOWED_SOURCE.test(target) ? unresolvedImportsFrom({ entry: target, visited }) : [];
  });
};

const packagedHarnessTrees = (): readonly string[] => directories.listDirectory(packagedPluginRoot) ?? [];

const allRegisteredHookFiles = (): readonly string[] => [
  ...new Set([...registeredHookFilesByHarness().values()].flat()),
];

const hookFilesShippedIn = ({ harness }: { readonly harness: string }): readonly string[] =>
  registeredHookFilesByHarness().get(harness) ??
  allRegisteredHookFiles().filter((hookFile) =>
    files.exists(paths.join({ segments: [packagedPluginRoot, harness, "hooks", hookFile] })),
  );

describe("every packaged harness tree carries what its registered hooks import", () => {
  test("the built plugin output holds a tree for every harness", () => {
    expect([...packagedHarnessTrees()].sort()).toStrictEqual(
      ["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"],
    );
  });

  test.each(["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"])(
    "the %s tree resolves every relative import of every registered hook",
    (harness) => {
      const hooksDirectory = paths.join({ segments: [packagedPluginRoot, harness, "hooks"] });
      const shipped = hookFilesShippedIn({ harness });
      expect(shipped).toContain("block-inline-exec.ts");
      const missing = shipped.flatMap((hookFile) => {
        const entry = paths.join({ segments: [hooksDirectory, hookFile] });
        return files.exists(entry)
          ? unresolvedImportsFrom({ entry, visited: new Set<string>() })
          : [`${hookFile} is not shipped`];
      });
      expect(missing).toStrictEqual([]);
    },
  );
});
