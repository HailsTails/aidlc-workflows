import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type ContextArrows = {
  readonly dependsOn: readonly string[];
  readonly readsFileFormatsOf: readonly string[];
  readonly composesRootsOf: readonly string[];
};

export type Bridge = {
  readonly module: string;
  readonly readBy: string;
  readonly reads: "types" | "runtime";
  readonly retiresWhen: string;
};

export type BridgeMap = {
  readonly contexts: Readonly<Record<string, ContextArrows>>;
  readonly bridges: readonly Bridge[];
  readonly legacyOwners: Readonly<Record<string, readonly string[]>>;
};

type SourceBridge = Omit<Bridge, "reads">;

const INTERNAL_REFERENCE = / \(R1\)/g;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isContextRule = (value: unknown): value is ContextArrows =>
  isRecord(value) &&
  isStringList(value["dependsOn"]) &&
  isStringList(value["readsFileFormatsOf"]) &&
  isStringList(value["composesRootsOf"]);

const isSourceBridge = (value: unknown): value is SourceBridge =>
  isRecord(value) &&
  typeof value["module"] === "string" &&
  typeof value["readBy"] === "string" &&
  typeof value["retiresWhen"] === "string";

const exported = <T>(module: Readonly<Record<string, unknown>>, name: string, guard: (value: unknown) => value is T): T => {
  const value = module[name];
  if (!guard(value)) throw new Error(`context map export ${name} has an unexpected shape`);
  return value;
};

const recordOf =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is Readonly<Record<string, T>> =>
    isRecord(value) && Object.values(value).every(guard);

const listOf =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is readonly T[] =>
    Array.isArray(value) && value.every(guard);

const loadModule = async (source: string): Promise<Readonly<Record<string, unknown>>> => {
  const folder = mkdtempSync(join(tmpdir(), "context-map-"));
  const file = join(folder, "context-map.ts");
  writeFileSync(file, source);
  try {
    const module: unknown = await import(pathToFileURL(file).href);
    if (!isRecord(module)) throw new Error("context map did not load as a module");
    return module;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};

const arrowsOnly = (rule: ContextArrows): ContextArrows => ({
  dependsOn: rule.dependsOn,
  readsFileFormatsOf: rule.readsFileFormatsOf,
  composesRootsOf: rule.composesRootsOf,
});

const bridgeReading =
  (reads: Bridge["reads"]) =>
  (bridge: SourceBridge): Bridge => ({
    module: bridge.module,
    readBy: bridge.readBy,
    reads,
    retiresWhen: bridge.retiresWhen.replace(INTERNAL_REFERENCE, ""),
  });

export const bridgeMapFrom = async (source: string): Promise<BridgeMap> => {
  const module = await loadModule(source);
  const contexts = exported(module, "CONTEXT_MAP", recordOf(isContextRule));
  return {
    contexts: Object.fromEntries(Object.entries(contexts).map(([name, rule]) => [name, arrowsOnly(rule)])),
    bridges: [
      ...exported(module, "SHIPPED_TYPE_BRIDGES", listOf(isSourceBridge)).map(bridgeReading("types")),
      ...exported(module, "LEGACY_BRIDGES", listOf(isSourceBridge)).map(bridgeReading("runtime")),
    ],
    legacyOwners: exported(module, "LEGACY_TERRITORY", recordOf(isStringList)),
  };
};

export const bridgeMapJson = (map: BridgeMap): string => `${JSON.stringify(map, null, 2)}\n`;

const code = (text: string): string => `\`${text}\``;

const arrowLine = ([name, rule]: readonly [string, ContextArrows]): string => {
  const depends = rule.dependsOn.length === 0 ? "nothing" : rule.dependsOn.map(code).join(", ");
  const formats = rule.readsFileFormatsOf.length === 0 ? "" : `; reads the file formats of ${rule.readsFileFormatsOf.map(code).join(", ")}`;
  return `- ${code(name)} depends on ${depends}${formats}`;
};

const bridgeRow = (bridge: Bridge): string =>
  `| ${code(bridge.module)} | ${code(bridge.readBy)} | ${bridge.reads} | ${bridge.retiresWhen} |`;

const ownerLine = ([context, files]: readonly [string, readonly string[]]): string =>
  `- ${code(context)}: ${files.map(code).join(", ")}`;

export const bridgeMapMarkdown = (map: BridgeMap): string =>
  [
    "Context arrows:",
    "",
    ...Object.entries(map.contexts).map(arrowLine),
    "",
    "| Legacy owner | Read by | Reads | Retires when |",
    "|---|---|---|---|",
    ...map.bridges.map(bridgeRow),
    "",
    "Legacy files each context takes over when its owner moves into `src/`:",
    "",
    ...Object.entries(map.legacyOwners).map(ownerLine),
  ].join("\n");
