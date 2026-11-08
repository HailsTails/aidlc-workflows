import {
  CONTEXT_MAP,
  CONTEXTS,
  HARNESS_NAMES,
  LEGACY_TERRITORY,
  type ContextName,
} from "./context-map.ts";
import type { GlossaryEntry } from "./glossary.ts";

export type ImportRestriction = { readonly regex: string; readonly message: string };

export type SyntaxRestriction = { readonly selector: string; readonly message: string };

export type Layer = "domain" | "application" | "adapters" | "fixtures" | "root";

type Placement = { readonly context: ContextName; readonly layer: Layer };

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const alternatives = (values: readonly string[]): string => values.map(escapeRegex).join("|");

const LEGACY_ROOTS = ["core", "scripts", "harness", "plugins", "tests", "examples", "dist"];

const isPure = (layer: Layer): boolean => layer === "domain" || layer === "application";

const privateLayersOf = (other: ContextName, placement: Placement): readonly string[] => {
  const rule = CONTEXT_MAP[placement.context];
  const composes = rule.composesRootsOf.includes(other);
  const hidden = composes ? [] : ["application/", "main\\.ts$"];
  const readsFormats = placement.layer === "adapters" && rule.readsFileFormatsOf.includes(other);
  const adapters = readsFormats ? "adapters/(?![\\w-]+-files?\\.ts$)" : "adapters/";
  return [...hidden, adapters];
};

const upstreamRestrictions = (other: ContextName, placement: Placement): ImportRestriction[] =>
  privateLayersOf(other, placement).map((layerPattern) => ({
    regex: `(^|/)${other}/${layerPattern}`,
    message:
      `Context boundary: ${placement.context} may use only ${other}'s published types in ` +
      `src/${other}/domain (and its adapters/*-file.ts formats where the map allows).`,
  }));

const otherContextRestrictions = (placement: Placement): ImportRestriction[] =>
  CONTEXTS.filter((other) => other !== placement.context).flatMap((other) =>
    CONTEXT_MAP[placement.context].dependsOn.includes(other)
      ? upstreamRestrictions(other, placement)
      : [
          {
            regex: `(^|/)${other}/`,
            message:
              `Context boundary: ${placement.context} may not depend on ${other}. ` +
              CONTEXT_MAP[placement.context].instead,
          },
        ],
  );

const OWN_LAYER_RESTRICTIONS: Readonly<Record<Layer, readonly ImportRestriction[]>> = {
  domain: [
    {
      regex: "^\\.\\./(application|adapters)/",
      message: "Layer: domain depends on nothing outward; move the type into domain.",
    },
  ],
  application: [
    {
      regex: "^\\.\\./adapters/",
      message: "Layer: application talks to adapters only through a port in ports.ts.",
    },
  ],
  adapters: [],
  fixtures: [],
  root: [],
};

const purityRestriction = (layer: Layer): ImportRestriction[] =>
  isPure(layer)
    ? [
        {
          regex: "^(?![./])",
          message:
            "Purity: domain and application import no packages, node: or Bun modules. Put " +
            "the effect behind a port in application/ports.ts and implement it in adapters/.",
        },
      ]
    : [];

const testSupportRestriction = (layer: Layer): ImportRestriction[] =>
  layer === "fixtures"
    ? []
    : [
        {
          regex: "(^|/)fixtures/",
          message: "Test support: production code never imports fixtures.",
        },
      ];

const monolithReachBack: ImportRestriction = {
  regex: `(^|/)(${alternatives(LEGACY_ROOTS)})/`,
  message:
    "Monolith: src/ never imports legacy code. Move the concept into its context and " +
    "delete the old owner in the same slice.",
};

export const srcImportRestrictions = (placement: Placement): ImportRestriction[] => [
  ...otherContextRestrictions(placement),
  ...OWN_LAYER_RESTRICTIONS[placement.layer],
  ...purityRestriction(placement.layer),
  ...testSupportRestriction(placement.layer),
  monolithReachBack,
];

const basenamePattern = (file: string): string =>
  file.endsWith("/**")
    ? `(^|/)${escapeRegex(file.slice(0, -3).split("/").at(-1) ?? file)}/`
    : `(^|/)${escapeRegex(file.split("/").at(-1) ?? file)}$`;

export const legacyImportRestrictions = (
  territory: Exclude<ContextName, "kernel">,
): ImportRestriction[] => {
  const rule = CONTEXT_MAP[territory];
  const forbidden = CONTEXTS.filter(
    (other): other is Exclude<ContextName, "kernel"> =>
      other !== "kernel" && other !== territory && !rule.dependsOn.includes(other),
  );
  return [
    {
      regex: "(^|/)aidlc-(lib|orchestrate|init)\\.ts$",
      message:
        `Monolith: today's ${territory} code leans on a monolith. When its lane moves this ` +
        `into src/${territory}, take what it uses from the owning context instead.`,
    },
    ...forbidden.map((other) => ({
      regex: LEGACY_TERRITORY[other].map(basenamePattern).join("|"),
      message: `Context boundary: today's ${territory} code imports ${other} code. ${rule.instead}`,
    })),
  ];
};

const harnessLiteral = `/^(${alternatives(HARNESS_NAMES)})$/`;

export const harnessBranching: readonly SyntaxRestriction[] = [
  "BinaryExpression[operator=/^[!=]==?$/] > Literal",
  "SwitchCase > Literal.test",
].map((selector) => ({
  selector: `${selector}[value=${harnessLiteral}]`,
  message:
    "Harness branching: only a Harness adapter may compare harness names. Express the " +
    "difference as a typed HarnessProfile capability or a Harness port method.",
}));

const DECLARATIONS = ":matches(TSTypeAliasDeclaration, TSInterfaceDeclaration, ClassDeclaration)";

export const ownershipInSrc = (
  context: ContextName,
  glossary: readonly GlossaryEntry[],
): SyntaxRestriction[] =>
  glossary
    .filter((entry) => entry.context !== context && entry.kind !== "variant")
    .map((entry) => ({
      selector: `${DECLARATIONS}[id.name="${entry.name}"]`,
      message:
        `One owner: ${entry.name} belongs to ${entry.context}. Import it from ` +
        `src/${entry.context}; to change it, ask Lane 0 to change the contract.`,
    }));

const namedAny = (node: string, names: readonly string[]): readonly string[] =>
  names.length > 0 ? [`${node}[id.name=/^(${alternatives(names)})$/]`] : [];

const legacySelectors = (entry: GlossaryEntry): readonly string[] => {
  const aliases = entry.legacy ?? [];
  const constants = aliases.filter((alias) => /^[A-Z0-9_]+$/.test(alias));
  const types = aliases.filter((alias) => !constants.includes(alias));
  const exportedTwin = `ExportNamedDeclaration > ${DECLARATIONS}[id.name="${entry.name}"]`;
  return [
    ...namedAny(DECLARATIONS, types),
    ...namedAny("VariableDeclarator", constants),
    exportedTwin,
  ];
};

export const legacyOwnership = (glossary: readonly GlossaryEntry[]): SyntaxRestriction[] =>
  glossary
    .filter((entry) => entry.kind !== "technical" && entry.kind !== "variant")
    .flatMap((entry) =>
      legacySelectors(entry).map((selector) => ({
        selector,
        message:
          `One owner: this declares ${entry.name} again; it is owned by ${entry.context} in ` +
          `src/${entry.context}. Move callers onto that type and delete this declaration.`,
      })),
    );

export const domainClock: SyntaxRestriction = {
  selector: "NewExpression[callee.name='Date']",
  message: "Domain purity: take the time from the Clock port, never new Date().",
};
