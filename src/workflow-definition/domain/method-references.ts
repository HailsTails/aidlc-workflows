import type { CoreContent } from "./method.ts";
import type { MethodSourceLocation } from "./method-source.ts";
import type { DefinitionConcept, MethodRefusal } from "./refusals.ts";
import type { Stage } from "./stage.ts";

type Occurrence = { readonly name: string; readonly concept: DefinitionConcept;
  readonly source: MethodSourceLocation };

const agentsFor = (stage: Stage): readonly string[] => [
  ...(stage.participation.lead.kind === "agent" ? [stage.participation.lead.agent] : []),
  ...stage.participation.supports,
  ...(stage.review ? [stage.review.reviewer] : []),
];

const unknown = (request: { readonly names: readonly string[];
  readonly known: readonly string[]; readonly source: MethodSourceLocation;
  readonly concept: DefinitionConcept }): readonly MethodRefusal[] => request.names
  .filter((name) => !request.known.includes(name)).map((name) => ({
    kind: "unknown-reference", source: request.source, concept: request.concept, name,
  }));

const stageReferences = (core: CoreContent): readonly MethodRefusal[] =>
  core.stages.flatMap((stage) => {
    const source = { owner: stage.owner, path: stage.source };
    return [
      ...unknown({ names: stage.requires, known: core.stages.map((definition) => definition.slug),
        source, concept: "stage" }),
      ...unknown({ names: agentsFor(stage), known: core.agents.map((definition) => definition.slug),
        source, concept: "agent" }),
      ...unknown({ names: stage.sensors, known: core.sensors.map((definition) => definition.id),
        source, concept: "sensor" }),
    ];
  });

const membershipReferences = (core: CoreContent): readonly MethodRefusal[] =>
  core.memberships.flatMap((membership) => {
    const declaringStage = core.stages.find((stage) => stage.slug === membership.stage);
    const declaringScope = core.scopes.find((scope) => scope.name === membership.scope);
    const declaration = declaringStage ?? declaringScope;
    if (!declaration) return [{ kind: "unattributed-membership",
      scope: membership.scope, stage: membership.stage, declaredBy: membership.declaredBy }];
    const source = { path: declaration.source, owner: declaration.owner };
    return [
      ...unknown({ names: [membership.stage], known: core.stages.map((stage) => stage.slug),
        source, concept: "stage" }),
      ...unknown({ names: [membership.scope], known: core.scopes.map((scope) => scope.name),
        source, concept: "scope" }),
    ];
  });

export const validateCoreReferences = (core: CoreContent): readonly MethodRefusal[] => [
  ...stageReferences(core), ...membershipReferences(core),
  ...core.knowledge.flatMap((document) => document.audience.kind === "agent" ? unknown({
    names: [document.audience.agent], known: core.agents.map((agent) => agent.slug),
    source: { path: document.source, owner: document.owner }, concept: "agent",
  }) : []),
  ...core.rules.flatMap((rule) => rule.pairing.kind === "sensor" ? unknown({
    names: [rule.pairing.sensor], known: core.sensors.map((sensor) => sensor.id),
    source: { path: rule.source, owner: rule.owner }, concept: "sensor",
  }) : []),
];
const occurrences = (core: CoreContent): readonly Occurrence[] => [
  ...core.stages.map((definition) => ({ name: definition.slug, concept: "stage" as const,
    source: { path: definition.source, owner: definition.owner } })),
  ...core.scopes.map((definition) => ({ name: definition.name, concept: "scope" as const,
    source: { path: definition.source, owner: definition.owner } })),
  ...core.agents.map((definition) => ({ name: definition.slug, concept: "agent" as const,
    source: { path: definition.source, owner: definition.owner } })),
  ...core.sensors.map((definition) => ({ name: definition.id, concept: "sensor" as const,
    source: { path: definition.source, owner: definition.owner } })),
  ...core.rules.map((definition) => ({ name: definition.id, concept: "rule" as const,
    source: { path: definition.source, owner: definition.owner } })),
];

export const validateCoreDuplicates = (core: CoreContent): readonly MethodRefusal[] => {
  const entries = occurrences(core);
  return entries.flatMap((entry, index) => {
    const prior = entries.slice(0, index).find((candidate) =>
      candidate.concept === entry.concept && candidate.name === entry.name);
    return prior ? [{ kind: "duplicate", name: entry.name, concept: entry.concept,
      sources: [prior.source, entry.source] }] : [];
  });
};

export const validateArtifactProducers = (core: CoreContent): readonly MethodRefusal[] => {
  const consumed = new Set(core.stages.flatMap((stage) => stage.consumes
    .map((consumption) => consumption.artifact)));
  const artifacts = [...new Set(core.stages.flatMap((stage) => stage.produces
    .map((production) => production.artifact)))];
  return artifacts.filter((artifact) => consumed.has(artifact)).flatMap((artifact) => {
    const producers = core.stages.filter((stage) => stage.produces.some((production) =>
      production.artifact === artifact));
    const [first, second] = producers;
    return first && second ? [{ kind: "duplicate", concept: "artifact", name: artifact,
      sources: [{ owner: first.owner, path: first.source },
        { owner: second.owner, path: second.source }] }] : [];
  });
};
