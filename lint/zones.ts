export type ZoneRoots = {
  readonly folders: readonly string[];
  readonly files: readonly string[];
};

export type Zone = "clean" | "scaffolding" | "debt";

export const CLEAN_ZONE: ZoneRoots = {
  folders: ["src", "lint"],
  files: [
    "eslint.config.ts",
    "eslint.config.test.ts",
    "disciplines.json",
    "discipline-exceptions.json",
    "disciplines.eslint.mjs",
    "disciplines.eslint.d.mts",
    "scripts/package.ts",
  ],
};

export const SCAFFOLDING_ZONE: ZoneRoots = {
  folders: ["lint/gate"],
  files: ["scripts/gate.ts", "lanes.json"],
};

const TYPESCRIPT_MODULE = /\.(ts|tsx|mts|cts)$/;

const COMPILER_CONFIG = "tsconfig.json";

const within = (roots: ZoneRoots, path: string): "inside" | "outside" =>
  roots.files.includes(path) || roots.folders.some((folder) => path.startsWith(`${folder}/`))
    ? "inside"
    : "outside";

export const zoneOf = (path: string): Zone => {
  if (within(SCAFFOLDING_ZONE, path) === "inside") {
    return "scaffolding";
  }
  return within(CLEAN_ZONE, path) === "inside" ? "clean" : "debt";
};

export const moduleKindOf = (path: string): "typescript" | "other" =>
  TYPESCRIPT_MODULE.test(path) ? "typescript" : "other";

const auditReads = (path: string): "audited" | "unread" =>
  moduleKindOf(path) === "typescript" || path.split("/").at(-1) === COMPILER_CONFIG
    ? "audited"
    : "unread";

const typescriptGlobs = (roots: ZoneRoots): readonly string[] => [
  ...roots.folders.map((folder) => `${folder}/**/*.{ts,tsx,mts,cts}`),
  ...roots.files.filter((file) => moduleKindOf(file) === "typescript"),
];

export const CLEAN_TYPESCRIPT: readonly string[] = typescriptGlobs(CLEAN_ZONE);

export const SCAFFOLDING_TYPESCRIPT: readonly string[] = typescriptGlobs(SCAFFOLDING_ZONE);

const prefixesOf = (path: string): readonly string[] => {
  const segments = path.split("/");
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
};

const excludedEntry =
  (cleanPaths: readonly string[]) =>
  (path: string): string | undefined =>
  prefixesOf(path).find(
    (prefix) => !cleanPaths.some((clean) => clean === prefix || clean.startsWith(`${prefix}/`)),
  );

export const auditExcludes = (trackedPaths: readonly string[]): readonly string[] => {
  const audited = trackedPaths.filter((path) => auditReads(path) === "audited");
  const cleanPaths = audited.filter((path) => zoneOf(path) === "clean");
  const entries = audited
    .filter((path) => zoneOf(path) !== "clean")
    .map(excludedEntry(cleanPaths))
    .filter((entry) => entry !== undefined);
  return [...new Set(entries)].sort();
};
