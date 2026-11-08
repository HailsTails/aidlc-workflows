import type { Linter } from "./eslint-port.ts";
import { KNOWLEDGE_FS_READS } from "./biome-successor.ts";
import {
  CONTEXTS,
  HARNESS_ADAPTER_FILES,
  HOST_BUNDLE_ROOT,
  LEGACY_BRIDGES,
  LEGACY_TERRITORY,
  MONOLITH_FILES,
  type ContextName,
  type LegacyBridge,
} from "./context-map.ts";
import { GLOSSARY } from "./glossary.ts";
import {
  domainClock,
  harnessBranching,
  bridgeImportRestrictions,
  hostBundleImportRestrictions,
  legacyImportRestrictions,
  legacyOwnership,
  methodAssertion,
  methodSyntaxFor,
  ownershipInSrc,
  purityOf,
  testImportRestrictions,
  srcImportRestrictions,
  type ImportRestriction,
  type Layer,
  type SyntaxRestriction,
} from "./restrictions.ts";

type Territory = keyof typeof LEGACY_TERRITORY;

const LAYERS: readonly Layer[] = ["domain", "application", "adapters", "fixtures", "root"];

const KERNEL_LAYERS: readonly Layer[] = ["domain", "fixtures"];

const layersOf = (context: ContextName): readonly Layer[] =>
  context === "kernel" ? KERNEL_LAYERS : LAYERS;

const testedLayersOf = (context: ContextName): readonly Layer[] =>
  layersOf(context).filter((layer) => layer !== "fixtures");

const LEGACY_FILES = ["core/**/*.ts", "scripts/**/*.ts", "plugins/*/tools/**/*.ts"];

const TERRITORIES: readonly Territory[] = CONTEXTS.filter(
  (context): context is Territory => context !== "kernel",
);


const asFileGlob = (entry: string): string => (entry.endsWith("/**") ? `${entry}/*.ts` : entry);

const HARNESS_ADAPTER_GLOBS = HARNESS_ADAPTER_FILES.map(asFileGlob);

const HOST_BUNDLE_FILES = `${HOST_BUNDLE_ROOT}/**/*.ts`;

const contextOf = (path: string): ContextName | undefined =>
  CONTEXTS.find((context) => path.startsWith(`src/${context}/`));

const restrict = (request: {
  readonly imports: readonly ImportRestriction[];
  readonly syntax: readonly SyntaxRestriction[];
}): Linter.RulesRecord => ({
  "no-restricted-imports": ["error", { patterns: [...request.imports] }],
  "no-restricted-syntax": ["error", ...request.syntax],
});

const srcFiles = (context: ContextName, layer: Layer): string[] => {
  if (context === "kernel") {
    return layer === "fixtures" ? ["src/kernel/fixtures/**/*.ts"] : ["src/kernel/*.ts"];
  }
  return layer === "root" ? [`src/${context}/*.ts`] : [`src/${context}/${layer}/**/*.ts`];
};

const EFFECT_GLOBALS = [
  "process",
  "Bun",
  "Deno",
  "require",
  "fetch",
  "setTimeout",
  "setInterval",
  "console",
];

const PURE_RULES: Linter.RulesRecord = {
  "no-restricted-globals": [
    "error",
    ...EFFECT_GLOBALS.map((name) => ({
      name,
      message: `Domain purity: ${name} is an effect; reach it through a port.`,
    })),
  ],
  "no-restricted-properties": [
    "error",
    { object: "Date", property: "now", message: "Domain purity: use the Clock port." },
    { object: "Math", property: "random", message: "Domain purity: inject randomness." },
  ],
};

const srcSyntax = (context: ContextName, layer: Layer): SyntaxRestriction[] => {
  const branded = [
    ...harnessBranching,
    ...ownershipInSrc(context, GLOSSARY),
    ...methodSyntaxFor(context, layer),
  ];
  return purityOf(layer) === "pure" ? [...branded, domainClock] : branded;
};

const srcLayerConfig = (context: ContextName, layer: Layer): Linter.Config => ({
  name: `aidlc/src/${context}/${layer}`,
  files: srcFiles(context, layer),
  rules: {
    ...restrict({
      imports: srcImportRestrictions({ context, layer }),
      syntax: srcSyntax(context, layer),
    }),
    ...(purityOf(layer) === "pure" ? PURE_RULES : {}),
  },
});

const srcTestConfig = (context: ContextName, layer: Layer): Linter.Config => ({
  name: `aidlc/src/${context}/${layer}/tests`,
  files: srcFiles(context, layer).map((glob) => glob.replace(/\.ts$/, ".test.ts")),
  rules: {
    "no-restricted-imports": [
      "error",
      { patterns: [...testImportRestrictions({ context, layer })] },
    ],
  },
});

const hostBundleConfig: Linter.Config = {
  name: "aidlc/src/hosts",
  files: [HOST_BUNDLE_FILES],
  rules: restrict({
    imports: hostBundleImportRestrictions(),
    syntax: [...ownershipInSrc(undefined, GLOSSARY), ...methodAssertion],
  }),
};

const bridgeConfig = (bridge: LegacyBridge, context: ContextName): Linter.Config => ({
  name: `aidlc/src/legacy-bridge/${bridge.readBy}`,
  files: [bridge.readBy],
  rules: restrict({
    imports: bridgeImportRestrictions({
      placement: { context, layer: "adapters" },
      bridgedModule: bridge.module,
    }),
    syntax: srcSyntax(context, "adapters"),
  }),
});

const legacyBridgeConfigs = (bridge: LegacyBridge): Linter.Config[] => {
  const context = contextOf(bridge.readBy);
  return context === undefined ? [] : [bridgeConfig(bridge, context)];
};

const legacySyntax = (): SyntaxRestriction[] => [...harnessBranching, ...legacyOwnership(GLOSSARY)];

const legacyTerritoryConfig = (territory: Territory): Linter.Config => ({
  name: `aidlc/legacy/${territory}`,
  files: LEGACY_TERRITORY[territory].map(asFileGlob),
  rules: restrict({ imports: legacyImportRestrictions(territory), syntax: legacySyntax() }),
});

const unassignedLegacyConfig: Linter.Config = {
  name: "aidlc/legacy/unassigned",
  files: LEGACY_FILES,
  ignores: [...TERRITORIES.flatMap((t) => LEGACY_TERRITORY[t].map(asFileGlob)), ...MONOLITH_FILES],
  rules: restrict({ imports: [], syntax: legacySyntax() }),
};

const monolithConfig: Linter.Config = {
  name: "aidlc/legacy/monolith",
  files: [...MONOLITH_FILES],
  rules: restrict({ imports: [], syntax: legacySyntax() }),
};

const harnessTreeConfig: Linter.Config = {
  name: "aidlc/legacy/harness-tree",
  files: HARNESS_ADAPTER_GLOBS.filter((glob) => glob.startsWith("harness/")),
  rules: restrict({ imports: [], syntax: legacyOwnership(GLOSSARY) }),
};

const knowledgeConfig: Linter.Config = {
  name: "aidlc/legacy/knowledge-read-only-fs",
  files: ["core/tools/aidlc-knowledge.ts"],
  rules: KNOWLEDGE_FS_READS,
};

export const boundaryConfig: Linter.Config[] = [
  unassignedLegacyConfig,
  knowledgeConfig,
  ...TERRITORIES.map(legacyTerritoryConfig),
  monolithConfig,
  harnessTreeConfig,
  ...CONTEXTS.flatMap((context) => layersOf(context).map((layer) => srcLayerConfig(context, layer))),
  ...CONTEXTS.flatMap((context) =>
    testedLayersOf(context).map((layer) => srcTestConfig(context, layer)),
  ),
  hostBundleConfig,
  ...LEGACY_BRIDGES.flatMap(legacyBridgeConfigs),
  {
    name: "aidlc/lint-tooling/pure",
    files: ["lint/gate/domain/**/*.ts", "lint/gate/application/**/*.ts"],
    rules: PURE_RULES,
  },
];
