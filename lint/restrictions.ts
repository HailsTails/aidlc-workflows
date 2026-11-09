import { CONTEXT_MAP, CONTEXTS, LEGACY_TERRITORY, type ContextName } from "./context-map.ts";
import type { GlossaryEntry } from "./glossary.ts";
import { HARNESS_FOLDER_NAMES } from "./harness-folders.ts";

export type ImportRestriction = { readonly regex: string; readonly message: string };

export type SyntaxRestriction = { readonly selector: string; readonly message: string };

export type Layer = "domain" | "application" | "adapters" | "fixtures" | "root";

type Placement = { readonly context: ContextName; readonly layer: Layer };

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const alternatives = (values: readonly string[]): string => values.map(escapeRegex).join("|");

const LEGACY_ROOTS = ["core", "scripts", "harness", "plugins", "tests", "examples", "dist"];

export const purityOf = (layer: Layer): "pure" | "effectful" =>
  layer === "domain" || layer === "application" ? "pure" : "effectful";

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

const forbiddenContext = (other: ContextName, placement: Placement): ImportRestriction => {
  const { instead } = CONTEXT_MAP[placement.context];
  return {
    regex: `(^|/)${other}/`,
    message: `Context boundary: ${placement.context} may not depend on ${other}. ${instead}`,
  };
};

const otherContextRestrictions = (placement: Placement): ImportRestriction[] =>
  CONTEXTS.filter((other) => other !== placement.context).flatMap((other) =>
    CONTEXT_MAP[placement.context].dependsOn.includes(other)
      ? upstreamRestrictions(other, placement)
      : [forbiddenContext(other, placement)],
  );

const ROOTED_CONTEXTS = alternatives(CONTEXTS.filter((context) => context !== "kernel"));

const contextRootReach = (layer: Layer): ImportRestriction => ({
  regex: `^(\\.\\./)+[\\w-]+\\.ts$|(^|/)(${ROOTED_CONTEXTS})/[\\w-]+\\.ts$`,
  message:
    `Layer: ${layer} never imports a context root such as main.ts; the root wires ` +
    `${layer}, not the reverse.`,
});

const OWN_LAYER_RESTRICTIONS: Readonly<Record<Layer, readonly ImportRestriction[]>> = {
  domain: [
    {
      regex: "(^|/)(application|adapters)/",
      message: "Layer: domain depends on nothing outward; move the type into domain.",
    },
    contextRootReach("domain"),
  ],
  application: [
    {
      regex: "(^|/)adapters/",
      message: "Layer: application talks to adapters only through a port in ports.ts.",
    },
    contextRootReach("application"),
  ],
  adapters: [],
  fixtures: [],
  root: [],
};

const rootEffects: ImportRestriction = {
  regex: "^(?![./])",
  message:
    "Layer: a root composes. It imports its own application, adapters and domain and the " +
    "kernel, and receives the platform as parameters; only src/cli reaches node:, Bun or " +
    "a package.",
};

const rootEffectRestrictions = (placement: Placement): ImportRestriction[] =>
  placement.layer === "root" && placement.context !== "cli" ? [rootEffects] : [];

const purityRestriction = (layer: Layer): ImportRestriction[] =>
  purityOf(layer) === "pure"
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

const MONOLITH_MOVE =
  "Monolith: src/ never imports legacy code. Move the concept into its context and " +
  "delete the old owner in the same slice.";

const monolithReachBack: ImportRestriction = {
  regex: `(^|/)(${alternatives(LEGACY_ROOTS)})/`,
  message: MONOLITH_MOVE,
};

const bridgedReachBack = (bridgedModule: string): ImportRestriction => ({
  regex: `(^|/)(?!${escapeRegex(bridgedModule)}$)(${alternatives(LEGACY_ROOTS)})/`,
  message: `${MONOLITH_MOVE} This adapter's one legacy bridge is ${bridgedModule}.`,
});

const hostBundleReach: ImportRestriction = {
  regex: "(^|/)hosts/",
  message:
    "Host bundle: only the composition roots in src/cli/*.ts import src/hosts. Depend on " +
    "the port the host implements and let the root wire it.",
};

const hostReachFor = (placement: Placement): readonly ImportRestriction[] =>
  placement.context === "cli" && placement.layer === "root" ? [] : [hostBundleReach];

const testDiscipline: readonly ImportRestriction[] = [
  {
    regex: "(^|/)adapters/",
    message:
      "Test discipline: a domain or application test imports no adapter. Build values " +
      "from the context's fixtures and fake the port inside the test.",
  },
  {
    regex: "^(?![./])(?!bun:test$)",
    message:
      "Test discipline: a domain or application test touches no real filesystem, process " +
      "or package. Use fixtures and an in-memory fake of the port.",
  },
];

const platformFreeTest: ImportRestriction = {
  regex: "^(node:|bun:(?!test$)|bun$)",
  message:
    "Test discipline: an adapter or root test imports no node: or Bun module. Reach the " +
    "platform through the kernel's fake of the port, or register the test as an " +
    "implementer's hermetic test in lint/implementers.json.",
};

const layerTestDiscipline = (layer: Layer): readonly ImportRestriction[] => {
  if (purityOf(layer) === "pure") {
    return testDiscipline;
  }
  return layer === "fixtures" ? [] : [platformFreeTest];
};

export const hermeticTestImportRestrictions = (placement: Placement): ImportRestriction[] => [
  ...otherContextRestrictions(placement),
  ...OWN_LAYER_RESTRICTIONS[placement.layer],
  ...hostReachFor(placement),
  monolithReachBack,
];

export const testImportRestrictions = (placement: Placement): ImportRestriction[] => [
  ...hermeticTestImportRestrictions(placement),
  ...layerTestDiscipline(placement.layer),
];

export const srcImportRestrictions = (placement: Placement): ImportRestriction[] => [
  ...otherContextRestrictions(placement),
  ...OWN_LAYER_RESTRICTIONS[placement.layer],
  ...rootEffectRestrictions(placement),
  ...purityRestriction(placement.layer),
  ...testSupportRestriction(placement.layer),
  ...hostReachFor(placement),
  monolithReachBack,
];

export const bridgeImportRestrictions = (request: {
  readonly placement: Placement;
  readonly bridgedModule: string;
}): ImportRestriction[] => [
  ...srcImportRestrictions(request.placement).filter((entry) => entry !== monolithReachBack),
  bridgedReachBack(request.bridgedModule),
];

const PUBLISHED_TO_HOSTS = "domain/|application/(boundary-)?ports\\.ts$";

const contextReachFromHosts = (published: string): ImportRestriction[] =>
  CONTEXTS.filter((context) => context !== "kernel").map((context) => ({
    regex: `(^|/)${context}/(?!${published})`,
    message:
      `Host bundle: a host implements ports. Import only ${context}'s domain, ` +
      "application/ports.ts or application/boundary-ports.ts; the root wires the rest.",
  }));

export const hostBundleImportRestrictions = (): ImportRestriction[] => [
  ...contextReachFromHosts(PUBLISHED_TO_HOSTS),
  ...testSupportRestriction("adapters"),
  monolithReachBack,
];

export const hostTestImportRestrictions = (): ImportRestriction[] => [
  ...contextReachFromHosts(`${PUBLISHED_TO_HOSTS}|fixtures/`),
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

const HARNESSES = alternatives(HARNESS_FOLDER_NAMES);

const harnessName = `/^\\.?(${HARNESSES})$/`;

const harnessPath = `/^\\.?(${HARNESSES})\\//`;

export const harnessBranching: readonly SyntaxRestriction[] = [
  "BinaryExpression[operator=/^[!=]==?$/] > Literal",
  "SwitchCase > Literal.test",
].map((selector) => ({
  selector: `${selector}[value=${harnessName}]`,
  message:
    "Harness branching: only a host bundle may compare harness names. Express the " +
    "difference as a port method that src/hosts/<harness>/ implements.",
}));

const KEYED = ":matches(Property, TSPropertySignature)";

export const harnessNames: readonly SyntaxRestriction[] = [
  ...harnessBranching.map((restriction) => restriction.selector),
  `Literal[value=${harnessPath}]`,
  `TemplateElement[value.raw=${harnessPath}]`,
  `TSLiteralType > Literal[value=${harnessName}]`,
  `CallExpression > Literal.arguments[value=${harnessName}]`,
  `${KEYED} > Identifier.key[name=${harnessName}]`,
  `${KEYED} > Literal.key[value=${harnessName}]`,
  `MemberExpression > Identifier.property[name=${harnessName}]`,
  `MemberExpression > Literal.property[value=${harnessName}]`,
].map((selector) => ({
  selector,
  message:
    "Harness name: only a host bundle in src/hosts/<harness>/ names a harness or its " +
    "folders. Express the difference as a port method the host implements.",
}));

const DECLARATIONS = ":matches(TSTypeAliasDeclaration, TSInterfaceDeclaration, ClassDeclaration)";

const PUBLISHED_TYPES =
  "ExportNamedDeclaration > " +
  ":matches(TSTypeAliasDeclaration, TSInterfaceDeclaration, ClassDeclaration, TSEnumDeclaration)";

export const unglossedTypes = (
  context: ContextName,
  glossary: readonly GlossaryEntry[],
): SyntaxRestriction => {
  const names = glossary.filter((entry) => entry.context === context).map((entry) => entry.name);
  return {
    selector: `${PUBLISHED_TYPES}[id.name!=/^(${alternatives(names)})$/]`,
    message:
      `One owner: ${context} publishes a type the glossary does not name. Add it to ` +
      `src/glossary.json for ${context} as a concept, or as a variant of its owner when ` +
      "it translates at a boundary.",
  };
};

export const undecodedJson: SyntaxRestriction = {
  selector:
    "CallExpression[callee.object.name='JSON'][callee.property.name='parse']" +
    ":not(CallExpression[callee.property.name=/^(parse|safeParse)$/] > CallExpression.arguments)",
  message:
    "Edge decoding: an adapter hands JSON.parse's result straight to Schema.parse or " +
    "safeParse, so unchecked JSON never travels past the edge.",
};

const ownerRestriction = (entry: GlossaryEntry): SyntaxRestriction => ({
  selector: `${DECLARATIONS}[id.name="${entry.name}"]`,
  message:
    `One owner: ${entry.name} belongs to ${entry.context}. Import it from ` +
    `src/${entry.context}, or move the concept there and delete this declaration.`,
});

export const ownershipInSrc = (
  context: ContextName | undefined,
  glossary: readonly GlossaryEntry[],
): SyntaxRestriction[] =>
  glossary
    .filter((entry) => entry.context !== context && entry.kind !== "variant")
    .map(ownerRestriction);

const BRANDED_BY_COMPILATION = "Method";

export const methodAssertion: readonly SyntaxRestriction[] = [
  "TSAsExpression",
  "TSTypeAssertion",
].map((node) => ({
  selector: `${node}[typeAnnotation.typeName.name="${BRANDED_BY_COMPILATION}"]`,
  message:
    "Branded method: only CompileMethod produces a Method. Take one from the CompileMethod " +
    "use case or through a port that returns it; never assert the type.",
}));

export const methodSyntaxFor = (
  context: ContextName,
  layer: Layer,
): readonly SyntaxRestriction[] =>
  layer === "fixtures" || (context === "workflow-definition" && layer === "application")
    ? []
    : methodAssertion;

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
  message: "Domain purity: take the time from the Clock port; the domain never reads the clock.",
};

export const dynamicImport: SyntaxRestriction = {
  selector: "ImportExpression",
  message:
    "Purity: a dynamic import loads code at run time, which is an effect. Import statically, " +
    "or put the loading behind a port in application/ports.ts.",
};
