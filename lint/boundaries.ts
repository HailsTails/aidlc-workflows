import type { Linter } from "eslint";
import { KNOWLEDGE_FS_READS } from "./biome-successor.ts";
import {
  CONTEXTS,
  HARNESS_ADAPTER_FILES,
  LEGACY_TERRITORY,
  MONOLITH_FILES,
  type ContextName,
} from "./context-map.ts";
import { readGlossary, type GlossaryEntry } from "./glossary.ts";
import {
  domainClock,
  harnessBranching,
  legacyImportRestrictions,
  legacyOwnership,
  ownershipInSrc,
  pureTestImportRestrictions,
  srcImportRestrictions,
  type ImportRestriction,
  type Layer,
  type SyntaxRestriction,
} from "./restrictions.ts";

type Territory = keyof typeof LEGACY_TERRITORY;

const LAYERS: readonly Layer[] = ["domain", "application", "adapters", "fixtures", "root"];

const LEGACY_FILES = ["core/**/*.ts", "scripts/**/*.ts", "plugins/*/tools/**/*.ts"];

const TERRITORIES = Object.keys(LEGACY_TERRITORY) as readonly Territory[];

const glossary: readonly GlossaryEntry[] = readGlossary(
  new URL("../src/glossary.json", import.meta.url),
);

const asFileGlob = (entry: string): string => (entry.endsWith("/**") ? `${entry}/*.ts` : entry);

const HARNESS_ADAPTER_GLOBS = HARNESS_ADAPTER_FILES.map(asFileGlob);

type SrcHarnessAdapter = { readonly context: ContextName; readonly files: string };

const SRC_HARNESS_ADAPTERS: readonly SrcHarnessAdapter[] = [
  { context: "projection", files: "src/projection/adapters/harnesses/**/*.ts" },
  { context: "cli", files: "src/cli/adapters/hosts/**/*.ts" },
];

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

const isPure = (layer: Layer): boolean => layer === "domain" || layer === "application";

const srcSyntax = (context: ContextName, layer: Layer): SyntaxRestriction[] => {
  const shared = [...harnessBranching, ...ownershipInSrc(context, glossary)];
  return isPure(layer) ? [...shared, domainClock] : shared;
};

const srcLayerConfig = (context: ContextName, layer: Layer): Linter.Config => ({
  name: `aidlc/src/${context}/${layer}`,
  files: srcFiles(context, layer),
  ignores: SRC_HARNESS_ADAPTERS.map((adapter) => adapter.files),
  rules: {
    ...restrict({
      imports: srcImportRestrictions({ context, layer }),
      syntax: srcSyntax(context, layer),
    }),
    ...(isPure(layer) ? PURE_RULES : {}),
  },
});

const srcPureTestConfig = (context: ContextName, layer: Layer): Linter.Config => ({
  name: `aidlc/src/${context}/${layer}/tests`,
  files: srcFiles(context, layer).map((glob) => glob.replace(/\.ts$/, ".test.ts")),
  rules: {
    "no-restricted-imports": [
      "error",
      { patterns: [...pureTestImportRestrictions({ context, layer })] },
    ],
  },
});

const PURE_LAYERS: readonly Layer[] = ["domain", "application"];

const srcHarnessAdapterConfig =(adapter: SrcHarnessAdapter): Linter.Config => ({
  name: `aidlc/src/${adapter.context}/harness-adapters`,
  files: [adapter.files],
  rules: {
    ...restrict({
      imports: srcImportRestrictions({ context: adapter.context, layer: "adapters" }),
      syntax: ownershipInSrc(adapter.context, glossary),
    }),
  },
});

const legacySyntax = (): SyntaxRestriction[] => [...harnessBranching, ...legacyOwnership(glossary)];

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
  rules: restrict({ imports: [], syntax: legacyOwnership(glossary) }),
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
  ...CONTEXTS.flatMap((context) => LAYERS.map((layer) => srcLayerConfig(context, layer))),
  ...CONTEXTS.flatMap((context) => PURE_LAYERS.map((layer) => srcPureTestConfig(context, layer))),
  ...SRC_HARNESS_ADAPTERS.map(srcHarnessAdapterConfig),
  {
    name: "aidlc/lint-tooling/pure",
    files: ["lint/gate/domain/**/*.ts", "lint/gate/application/**/*.ts"],
    rules: PURE_RULES,
  },
];
