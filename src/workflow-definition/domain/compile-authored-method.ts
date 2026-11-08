import { brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { applyOverlays } from "./apply-overlays.ts";
import type { AuthoredBody } from "./outline.ts";
import { compileCoreMethod, compileFreshContent } from "./compile-core-method.ts";
import type { Contribution } from "./contribution.ts";
import type { CoreContent, Method, PluginSelection } from "./method.ts";
import { ownerEnabled, prepareContributions } from "./plugin-selection.ts";
import type { MethodRefusal } from "./refusals.ts";
import type { Stage } from "./stage.ts";

const combinedContent = (core: CoreContent, contributions: readonly Contribution[]): CoreContent =>
  contributions.reduce((prior, contribution) => ({ ...prior,
    stages: [...prior.stages, ...contribution.content.stages],
    agents: [...prior.agents, ...contribution.content.agents],
    scopes: [...prior.scopes, ...contribution.content.scopes],
    sensors: [...prior.sensors, ...contribution.content.sensors],
    rules: [...prior.rules, ...contribution.content.rules],
    knowledge: [...prior.knowledge, ...contribution.content.knowledge],
    memberships: [...prior.memberships, ...contribution.content.memberships],
    freeformDefaults: [...prior.freeformDefaults, ...contribution.content.freeformDefaults],
  }), core);

const ownershipIssues = (contributions: readonly Contribution[]): readonly MethodRefusal[] =>
  contributions.flatMap((entry) => [
    ...entry.content.stages, ...entry.content.agents, ...entry.content.scopes,
    ...entry.content.sensors, ...entry.content.rules, ...entry.content.knowledge,
  ].filter((definition) => definition.owner.kind !== "plugin"
    || definition.owner.plugin !== entry.plugin).map((definition) => ({ kind: "invalid-file",
    location: { kind: "method-source", owner: { kind: "plugin", plugin: entry.plugin },
      path: definition.source }, issues: ["A contribution may not claim another owner's definition."],
  })));

const selectionIssues = (request: { readonly content: CoreContent;
  readonly availability: (stage: Stage) => "enabled" | "disabled" }): readonly MethodRefusal[] =>
  request.content.stages.filter((stage) => request.availability(stage) === "enabled").flatMap((stage) =>
  stage.consumes.filter((consumption) => consumption.obligation === "required").flatMap((consumption) => {
    const producers = request.content.stages.filter((candidate) => candidate.produces.some((production) =>
      production.artifact === consumption.artifact));
    return producers.length > 0 && !producers.some((producer) => request.availability(producer) === "enabled") ? [{ kind: "invalid-file",
      location: { kind: "method-source", owner: stage.owner, path: stage.source },
      issues: [`Required artifact ${consumption.artifact} has only selection-disabled producers.`],
    }] : [];
  }));

export const compileAuthoredMethod = (request: { readonly core: CoreContent;
  readonly contributions: readonly Contribution[]; readonly selection: PluginSelection },
  outline: (text: string) => AuthoredBody): Result<Method, readonly MethodRefusal[]> => {
  const core = compileCoreMethod(request.core);
  if (!core.ok) return core;
  const prepared = prepareContributions(request);
  if (!prepared.ok) return prepared;
  const owned = ownershipIssues(prepared.value.ordered);
  if (owned.length > 0) return refused(owned);
  const applied = applyOverlays({ content: combinedContent(request.core, prepared.value.ordered),
    contributions: prepared.value.ordered.filter((entry) => prepared.value.selected.includes(entry.plugin)),
    outline });
  const availability = (stage: Stage) => ownerEnabled({ owner: stage.owner,
    selection: request.selection, selected: prepared.value.selected }) ? "enabled" : "disabled";
  const selection = selectionIssues({ content: applied.content, availability });
  if (selection.length > 0) return refused(selection);
  const fresh = compileFreshContent(applied.content);
  if (!fresh.ok) return fresh;
  const disabled = fresh.value.stages.filter((stage) => availability(stage) === "disabled")
    .map((stage) => stage.slug);
  return accepted(brand<Method>({ ...fresh.value,
    installedPlugins: prepared.value.ordered.map((entry) => entry.plugin), selection: request.selection,
    findings: applied.findings, graph: { nodes: fresh.value.graph.nodes.map((node) => ({ ...node,
      availability: disabled.includes(node.stage) ? "disabled" : "enabled" })) },
  }));
};
