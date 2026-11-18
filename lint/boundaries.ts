import type { Linter } from "./eslint-port.ts";
import { KNOWLEDGE_FS_READS } from "./biome-successor.ts";
import {
  CONTEXTS,
  HARNESS_ADAPTER_FILES,
  HOST_BUNDLE_ROOT,
  LEGACY_BRIDGES,
  LEGACY_TERRITORY,
  MONOLITH_FILES,
  SHIPPED_TYPE_BRIDGES,
  type ContextName,
  type LegacyBridge,
} from "./context-map.ts";
import { GLOSSARY } from "./glossary.ts";
import { IMPLEMENTERS, registeredGlobalRoots, type Implementer } from "./implementers.ts";
import {
  domainClock,
  dynamicImport,
  harnessBranching,
  harnessNames,
  bridgeImportRestrictions,
  hostBridgeImportRestrictions,
  hostBundleImportRestrictions,
  hostTestImportRestrictions,
  implementerConstruction,
  legacyImportRestrictions,
  legacyOwnership,
  methodAssertion,
  methodSyntaxFor,
  typeBridgeImportRestrictions,
  typeOnlyBridge,
  ownershipInSrc,
  purityOf,
  hermeticTestImportRestrictions,
  testImportRestrictions,
  srcImportRestrictions,
  undecodedJson,
  unglossedTypes,
  type ImportRestriction,
  type Layer,
  type SyntaxRestriction,
} from "./restrictions.ts";

type Territory = keyof typeof LEGACY_TERRITORY;

const LAYERS: readonly Layer[] = ["domain", "application", "adapters", "fixtures", "root"];

const CONTEXT_LAYERS: Readonly<Partial<Record<ContextName, readonly Layer[]>>> = {
  kernel: ["domain", "fixtures"],
  cli: ["adapters", "root"],
};

const layersOf = (context: ContextName): readonly Layer[] => CONTEXT_LAYERS[context] ?? LAYERS;

const testedLayersOf = (context: ContextName): readonly Layer[] =>
  layersOf(context).filter((layer) => layer !== "fixtures");

const PROCESS_ENTRIES: readonly string[] = [
  "src/cli/main.ts",
  "src/cli/legacy-runner-child.ts",
];

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
  "globalThis",
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

const layerSyntax = (context: ContextName, layer: Layer): SyntaxRestriction[] => {
  const branded = [...ownershipInSrc(context, GLOSSARY), ...methodSyntaxFor(context, layer)];
  return purityOf(layer) === "pure" ? [...branded, domainClock, dynamicImport] : branded;
};

const sampleSyntax = (context: ContextName, layer: Layer): SyntaxRestriction[] => [
  ...harnessBranching,
  ...layerSyntax(context, layer),
];

const edgeSyntax = (context: ContextName, layer: Layer): SyntaxRestriction[] => {
  if (layer === "domain") {
    return [unglossedTypes(context, GLOSSARY)];
  }
  return layer === "adapters" ? [undecodedJson] : [];
};

const productionSyntax = (context: ContextName, layer: Layer): SyntaxRestriction[] =>
  layer === "fixtures"
    ? sampleSyntax(context, layer)
    : [...harnessNames, ...layerSyntax(context, layer), ...edgeSyntax(context, layer)];

const constructionRefused = (syntax: readonly SyntaxRestriction[]): SyntaxRestriction[] => [
  ...syntax,
  implementerConstruction(IMPLEMENTERS.map((implementer) => implementer.factory)),
];

const srcLayerConfig = (context: ContextName, layer: Layer): Linter.Config => ({
  name: `aidlc/src/${context}/${layer}`,
  files: srcFiles(context, layer),
  rules: {
    ...restrict({
      imports: srcImportRestrictions({ context, layer }),
      syntax: constructionRefused(productionSyntax(context, layer)),
    }),
    ...(purityOf(layer) === "pure" ? PURE_RULES : {}),
  },
});

const PORT_FILES = ["ports", "ports/!(*.test)", "boundary-ports"];

const srcPortsConfig = (context: ContextName): Linter.Config => ({
  name: `aidlc/src/${context}/application/ports`,
  files: PORT_FILES.map((file) => `src/${context}/application/${file}.ts`),
  rules: {
    ...restrict({
      imports: srcImportRestrictions({ context, layer: "application" }),
      syntax: constructionRefused([
        ...productionSyntax(context, "application"),
        unglossedTypes(context, GLOSSARY),
      ]),
    }),
    ...PURE_RULES,
  },
});

export const portFilesConfig: Linter.Config[] = CONTEXTS.filter((context) =>
  layersOf(context).includes("application"),
).map(srcPortsConfig);

const srcTestConfig = (context: ContextName, layer: Layer): Linter.Config => ({
  name: `aidlc/src/${context}/${layer}/tests`,
  files: srcFiles(context, layer).map((glob) => glob.replace(/\.ts$/, ".test.ts")),
  rules: restrict({
    imports: testImportRestrictions({ context, layer }),
    syntax: sampleSyntax(context, layer),
  }),
});

const DECLARED_SRC_FILES = [
  ...CONTEXTS.flatMap((context) => layersOf(context).flatMap((layer) => srcFiles(context, layer))),
  HOST_BUNDLE_FILES,
];

const undeclaredSrcConfig: Linter.Config = {
  name: "aidlc/src/undeclared",
  files: ["src/**/*.ts"],
  ignores: DECLARED_SRC_FILES,
  rules: restrict({
    imports: [],
    syntax: [
      {
        selector: "Program",
        message:
          "Layer: this file is not a layer of a context in lint/context-map.ts; move it to " +
          "src/<context>/<layer> or src/hosts/<harness>.",
      },
    ],
  }),
};

const HOST_BUNDLE_SYNTAX = [...ownershipInSrc(undefined, GLOSSARY), ...methodAssertion];

const hostBundleConfig: Linter.Config = {
  name: "aidlc/src/hosts",
  files: [HOST_BUNDLE_FILES],
  rules: restrict({ imports: hostBundleImportRestrictions(), syntax: HOST_BUNDLE_SYNTAX }),
};

const hostTestConfig: Linter.Config = {
  name: "aidlc/src/hosts/tests",
  files: [HOST_BUNDLE_FILES.replace(/\.ts$/, ".test.ts")],
  rules: restrict({ imports: hostTestImportRestrictions(), syntax: HOST_BUNDLE_SYNTAX }),
};

const bridgeConfig = (bridge: LegacyBridge, context: ContextName): Linter.Config => ({
  name: `aidlc/src/legacy-bridge/${bridge.readBy}`,
  files: [bridge.readBy],
  rules: restrict({
    imports: bridgeImportRestrictions({
      placement: { context, layer: "adapters" },
      bridgedModule: bridge.module,
    }),
    syntax: constructionRefused(productionSyntax(context, "adapters")),
  }),
});

const layerOfReader = (path: string): Layer =>
  LAYERS.find((layer) => path.split("/").includes(layer)) ?? "adapters";

export const typeBridgeConfigs = (bridges: readonly LegacyBridge[]): Linter.Config[] =>
  [...new Set(bridges.map((bridge) => bridge.readBy))].flatMap((readBy) => {
    const context = contextOf(readBy);
    const bridgedModules = bridges.filter((bridge) => bridge.readBy === readBy).map((b) => b.module);
    const layer = layerOfReader(readBy);
    return context === undefined
      ? []
      : [
          {
            name: `aidlc/src/type-bridge/${readBy}`,
            files: [readBy],
            rules: restrict({
              imports: typeBridgeImportRestrictions({ placement: { context, layer }, bridgedModules }),
              syntax: [...productionSyntax(context, layer), ...typeOnlyBridge(bridgedModules)],
            }),
          },
        ];
  });

const hostBridgeConfig = (bridge: LegacyBridge): Linter.Config => ({
  name: `aidlc/src/legacy-bridge/${bridge.readBy}`,
  files: [bridge.readBy],
  rules: restrict({
    imports: hostBridgeImportRestrictions({ bridgedModule: bridge.module }),
    syntax: HOST_BUNDLE_SYNTAX,
  }),
});

export const legacyBridgeConfigs = (bridge: LegacyBridge): Linter.Config[] => {
  if (bridge.readBy.startsWith(`${HOST_BUNDLE_ROOT}/`)) {
    return [hostBridgeConfig(bridge)];
  }
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

const shippedOwnerConfig = (file: string): Linter.Config => ({
  name: `aidlc/legacy/shipped-owner/${file}`,
  files: [file],
  rules: {
    "no-restricted-syntax": ["error", ...harnessBranching, ...legacyOwnership(GLOSSARY, file)],
  },
});

const SHIPPED_OWNER_FILES = [
  ...new Set(GLOSSARY.flatMap((entry) => (entry.shippedOwner === undefined ? [] : [entry.shippedOwner]))),
];

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

const globalsWithout = (allowed: readonly string[]): Linter.RulesRecord => ({
  "no-restricted-globals": [
    "error",
    ...EFFECT_GLOBALS.filter((name) => !allowed.includes(name)).map((name) => ({
      name,
      message: `Domain purity: ${name} is an effect; reach it through a port.`,
    })),
  ],
});

const withoutProtocol = (module: string): string => module.replace(/^node:/, "");

const unregisteredModules = (implementer: Implementer): ImportRestriction => ({
  regex: `^node:(?!(?:${implementer.modules.map(withoutProtocol).join("|")})$)`,
  message:
    `Implementer: ${implementer.file} registers only ${implementer.modules.join(", ") || "no node: module"} ` +
    "in lint/implementers.json; a module outside that list is another way to reach the platform.",
});

const implementerPlacement = (file: string): { readonly context: ContextName; readonly layer: Layer } => ({
  context: contextOf(file) ?? "kernel",
  layer: layerOfReader(file),
});

const implementerConfig = (implementer: Implementer): Linter.Config => {
  const { context, layer } = implementerPlacement(implementer.file);
  return {
    name: `aidlc/src/kernel/implementer/${implementer.capability}`,
    files: [implementer.file],
    rules: {
      ...restrict({
        imports: [...srcImportRestrictions({ context, layer }), unregisteredModules(implementer)],
        syntax: [...productionSyntax(context, layer), dynamicImport],
      }),
      ...globalsWithout(registeredGlobalRoots(implementer)),
    },
  };
};

const hermeticTestConfig = (implementer: Implementer): Linter.Config => {
  const { context, layer } = implementerPlacement(implementer.hermeticTest);
  return {
    name: `aidlc/src/kernel/implementer/${implementer.capability}/hermetic-test`,
    files: [implementer.hermeticTest],
    rules: restrict({
      imports: hermeticTestImportRestrictions({ context, layer }),
      syntax: sampleSyntax(context, layer),
    }),
  };
};

const processEntryConfig: Linter.Config = {
  name: "aidlc/src/cli/process-entries",
  files: [...PROCESS_ENTRIES],
  rules: restrict({
    imports: srcImportRestrictions({ context: "cli", layer: "root" }),
    syntax: productionSyntax("cli", "root"),
  }),
};

const implementerConfigs: Linter.Config[] = IMPLEMENTERS.flatMap((implementer) => [
  implementerConfig(implementer),
  hermeticTestConfig(implementer),
]);

export const boundaryConfig: Linter.Config[] = [
  unassignedLegacyConfig,
  knowledgeConfig,
  ...TERRITORIES.map(legacyTerritoryConfig),
  monolithConfig,
  harnessTreeConfig,
  ...CONTEXTS.flatMap((context) => layersOf(context).map((layer) => srcLayerConfig(context, layer))),
  ...portFilesConfig,
  ...CONTEXTS.flatMap((context) =>
    testedLayersOf(context).map((layer) => srcTestConfig(context, layer)),
  ),
  ...implementerConfigs,
  undeclaredSrcConfig,
  hostBundleConfig,
  hostTestConfig,
  ...LEGACY_BRIDGES.flatMap(legacyBridgeConfigs),
  ...typeBridgeConfigs(SHIPPED_TYPE_BRIDGES),
  ...SHIPPED_OWNER_FILES.map(shippedOwnerConfig),
  processEntryConfig,
  {
    name: "aidlc/lint-tooling/pure",
    files: ["lint/gate/domain/**/*.ts", "lint/gate/application/**/*.ts"],
    rules: PURE_RULES,
  },
];
