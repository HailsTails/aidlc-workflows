import type { ProjectionContentInput } from "./projection-content.ts";
import {
  documentKey,
  finding,
  identifierStatus,
  pathStatus,
  selectionFor,
  sourceKey,
  type Finding,
  type NativeTier,
  type NeutralDocument,
  type Outcome,
  type ProjectionRequest,
  type Tier,
} from "./model.ts";

export type PreparationRules = {
  readonly pathStatus: typeof pathStatus;
  readonly identifierStatus: typeof identifierStatus;
  readonly selectionFor: typeof selectionFor;
};
export type Preparation = (request: ProjectionRequest) => Outcome<readonly PreparedProjection[]>;
export const createPreparationRules = (): PreparationRules => ({
  pathStatus,
  identifierStatus,
  selectionFor,
});
type PreparationContext = { readonly request: ProjectionRequest; readonly rules: PreparationRules };
const preparedProjection = Symbol("prepared-projection");
export type PreparedProjection = ProjectionContentInput & { readonly [preparedProjection]: true };
const rank: Readonly<Record<Tier, number>> = { templated: 0, balanced: 1, judgment: 2 };
const selectedDocuments = ({ request, rules }: PreparationContext): readonly NeutralDocument[] =>
  request.documents.filter(
    (document) =>
      rules.selectionFor({ source: document.source, plugins: request.selectedPlugins }) ===
      "selected",
  );
const duplicates = ({ keys }: { readonly keys: readonly string[] }): readonly Finding[] =>
  keys
    .filter((key, index) => keys.indexOf(key) !== index)
    .map((key) => finding({ code: "duplicate", subject: key, detail: "identity must be unique" }));

const identifierFindings = ({ request, rules }: PreparationContext): readonly Finding[] => {
  const identifiers = [
    request.contract.harness,
    ...request.selectedPlugins,
    ...request.documents.flatMap((document) => [
      document.source.id,
      document.id,
      ...document.knowledge,
    ]),
    ...request.knowledge.flatMap((knowledgeEntry) => [knowledgeEntry.source.id, knowledgeEntry.id]),
    ...request.reviewers.flatMap((reviewer) => [
      reviewer.source.id,
      reviewer.document,
      ...reviewer.knowledge,
    ]),
  ];
  return identifiers
    .filter((identifier) => rules.identifierStatus({ identifier }) === "invalid")
    .map((identifier) =>
      finding({
        code: "invalid-identifier",
        subject: identifier,
        detail: "expected a lowercase identifier of at most 256 characters",
      }),
    );
};

const contractFindings = ({ request, rules }: PreparationContext): readonly Finding[] => [
  ...[
    { subject: "contract.harnessDir", path: request.contract.harnessDir },
    { subject: "contract.rulesSubdir", path: request.contract.rulesSubdir },
    { subject: "contract.memoryRoot", path: request.contract.memoryRoot },
  ]
    .filter((reference) => rules.pathStatus({ path: reference.path }) === "unsafe")
    .map((reference) =>
      finding({
        code: "invalid-path",
        subject: reference.subject,
        detail: "expected a relative POSIX path without traversal",
      }),
    ),
  ...(request.contract.invocation.trim().length === 0
    ? [
        finding({
          code: "invalid-invocation",
          subject: "contract.invocation",
          detail: "invocation must not be empty",
        }),
      ]
    : []),
  ...Object.entries(request.contract.tiers).flatMap(([name, mapping]) =>
    Object.entries(mapping)
      .filter(([, nativeSetting]) => nativeSetting !== null && nativeSetting.trim().length === 0)
      .map(([field]) =>
        finding({
          code: "invalid-tier-mapping",
          subject: `contract.tiers.${name}.${field}`,
          detail: "native values must be non-empty or null",
        }),
      ),
  ),
];

const authoredContextFindings = ({ request }: PreparationContext): readonly Finding[] => [
  ...request.knowledge
    .filter((knowledgeEntry) => knowledgeEntry.body.trim().length === 0)
    .map((knowledgeEntry) =>
      finding({
        code: "empty-knowledge",
        subject: `${sourceKey(knowledgeEntry.source)}/${knowledgeEntry.id}`,
        detail: "required knowledge must not be empty",
      }),
    ),
  ...request.reviewers
    .filter((reviewer) => reviewer.knowledge.length === 0)
    .map((reviewer) =>
      finding({
        code: "missing-reviewer-knowledge",
        subject: `${sourceKey(reviewer.source)}/${reviewer.document}`,
        detail: "reviewers require explicit knowledge",
      }),
    ),
  ...request.documents.flatMap((document) => [
    ...(document.kind === "agent" &&
    (document.description === null || document.description.trim().length === 0)
      ? [
          finding({
            code: "missing-description",
            subject: documentKey(document),
            detail: "agents require a non-empty description",
          }),
        ]
      : []),
    ...(document.hook !== null && document.hook.command.trim().length === 0
      ? [
          finding({
            code: "empty-hook-command",
            subject: documentKey(document),
            detail: "hook command must not be empty",
          }),
        ]
      : []),
  ]),
];

const identityFindings = ({ request }: PreparationContext): readonly Finding[] => [
  ...duplicates({ keys: request.documents.map(documentKey) }),
  ...duplicates({
    keys: request.knowledge.map(
      (knowledgeEntry) => `${sourceKey(knowledgeEntry.source)}/${knowledgeEntry.id}`,
    ),
  }),
  ...duplicates({
    keys: request.reviewers.map((reviewer) => `${sourceKey(reviewer.source)}/${reviewer.document}`),
  }),
  ...duplicates({ keys: request.selectedPlugins }),
];

const reviewerFindings = ({ request, rules }: PreparationContext): readonly Finding[] =>
  request.reviewers
    .filter(
      (reviewer) =>
        rules.selectionFor({ source: reviewer.source, plugins: request.selectedPlugins }) ===
        "selected",
    )
    .filter(
      (reviewer) =>
        !selectedDocuments({ request, rules }).some(
          (document) =>
            sourceKey(document.source) === sourceKey(reviewer.source) &&
            document.id === reviewer.document &&
            document.kind === "agent",
        ),
    )
    .map((reviewer) =>
      finding({
        code: "missing-reviewer",
        subject: `${sourceKey(reviewer.source)}/${reviewer.document}`,
        detail: "selected reviewer needs an agent document",
      }),
    );

const pluginFindings = ({ request, rules }: PreparationContext): readonly Finding[] =>
  request.selectedPlugins
    .filter(
      (id) =>
        !selectedDocuments({ request, rules }).some(
          (document) => document.source.kind === "plugin" && document.source.id === id,
        ),
    )
    .map((id) =>
      finding({
        code: "missing-plugin",
        subject: id,
        detail: "selected plugin supplies no documents",
      }),
    );

type DocumentContext = PreparationContext & { readonly document: NeutralDocument };
const requiredKnowledge = ({ document, request }: DocumentContext): readonly string[] => {
  const reviewer = request.reviewers.find(
    (reviewer) => `${sourceKey(reviewer.source)}/${reviewer.document}` === documentKey(document),
  );
  return [...new Set([...document.knowledge, ...(reviewer?.knowledge ?? [])])].sort();
};

const agentFindings = ({ document }: DocumentContext): readonly Finding[] => [
  ...(document.kind === "agent" && document.tier === null
    ? [
        finding({
          code: "missing-tier",
          subject: documentKey(document),
          detail: "agents require an explicit tier",
        }),
      ]
    : []),
  ...(document.kind !== "agent" &&
  (document.tier !== null || document.hook !== null || document.knowledge.length > 0)
    ? [
        finding({
          code: "inapplicable-agent-context",
          subject: documentKey(document),
          detail: "tier, knowledge and reviewer hooks apply to agents",
        }),
      ]
    : []),
];

const capabilityFindings = (context: DocumentContext): readonly Finding[] => {
  const needed = [
    ...(context.document.kind === "agent" ? ["agents"] : []),
    ...(requiredKnowledge(context).length > 0 ? ["knowledge"] : []),
    ...(context.document.hook !== null ? ["hooks"] : []),
  ];
  return needed
    .filter(
      (capability) =>
        !context.request.contract.capabilities.some((supported) => supported === capability),
    )
    .map((capability) =>
      finding({
        code: "capability-gap",
        subject: documentKey(context.document),
        detail: `harness ${context.request.contract.harness} lacks ${capability}`,
      }),
    );
};

const missingKnowledge = (context: DocumentContext): readonly Finding[] =>
  requiredKnowledge(context)
    .filter(
      (id) =>
        !context.request.knowledge.some(
          (knowledgeEntry) =>
            sourceKey(knowledgeEntry.source) === sourceKey(context.document.source) &&
            knowledgeEntry.id === id,
        ),
    )
    .map((id) =>
      finding({
        code: "missing-knowledge",
        subject: documentKey(context.document),
        detail: `${sourceKey(context.document.source)}/${id} is required`,
      }),
    );

const preparationFindings = ({ request, rules }: PreparationContext): readonly Finding[] => [
  ...identifierFindings({ request, rules }),
  ...contractFindings({ request, rules }),
  ...authoredContextFindings({ request, rules }),
  ...identityFindings({ request, rules }),
  ...reviewerFindings({ request, rules }),
  ...pluginFindings({ request, rules }),
  ...selectedDocuments({ request, rules }).flatMap((document) => {
    const context = { document, request, rules };
    return [
      ...agentFindings(context),
      ...capabilityFindings(context),
      ...missingKnowledge(context),
    ];
  }),
];

const resolvedTier = ({ document, request }: DocumentContext): NativeTier | null => {
  if (document.tier === null) return null;
  const effective =
    rank[document.tier] > rank[request.contract.tierCap] ? request.contract.tierCap : document.tier;
  return Object.freeze({ ...request.contract.tiers[effective] });
};

const freezeDocument = (document: NeutralDocument): NeutralDocument =>
  Object.freeze({
    ...document,
    source: Object.freeze({ ...document.source }),
    knowledge: Object.freeze([...document.knowledge]),
    hook: document.hook === null ? null : Object.freeze({ ...document.hook }),
  });

const preparedDocument = (
  context: DocumentContext & { readonly preparedValues: WeakSet<object> },
): PreparedProjection => {
  const { document, request } = context;
  const prepared = Object.freeze<PreparedProjection>({
    [preparedProjection]: true,
    document: freezeDocument(document),
    contract: Object.freeze({
      harness: request.contract.harness,
      harnessDir: request.contract.harnessDir,
      rulesSubdir: request.contract.rulesSubdir,
      invocation: request.contract.invocation,
      memoryRoot: request.contract.memoryRoot,
    }),
    absorbedKnowledge: Object.freeze(
      requiredKnowledge(context).flatMap((id) =>
        request.knowledge
          .filter(
            (knowledgeEntry) =>
              sourceKey(knowledgeEntry.source) === sourceKey(document.source) &&
              knowledgeEntry.id === id,
          )
          .map((knowledgeEntry) => knowledgeEntry.body),
      ),
    ),
    nativeTier: resolvedTier(context),
  });
  context.preparedValues.add(prepared);
  return prepared;
};

export const createPreparation = (
  rules: PreparationRules = createPreparationRules(),
): PreparationService => {
  const preparedValues = new WeakSet<object>();
  const isPreparedProjection = (input: {
    readonly candidate: unknown;
  }): input is { readonly candidate: PreparedProjection } =>
    typeof input.candidate === "object" &&
    input.candidate !== null &&
    preparedValues.has(input.candidate);
  const prepare: Preparation = (request) => {
    const findings = preparationFindings({ request, rules });
    if (findings.length > 0) return { status: "invalid", findings };
    return {
      status: "ok",
      value: Object.freeze(
        selectedDocuments({ request, rules }).map((document) =>
          preparedDocument({ document, request, rules, preparedValues }),
        ),
      ),
    };
  };

  return Object.freeze({ prepare, isPreparedProjection });
};
export type PreparationService = {
  readonly prepare: Preparation;
  readonly isPreparedProjection: (input: {
    readonly candidate: unknown;
  }) => input is { readonly candidate: PreparedProjection };
};
const canonicalPreparation = createPreparation();
export const prepare = canonicalPreparation.prepare;
export const isPreparedProjection = canonicalPreparation.isPreparedProjection;
