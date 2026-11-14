import type { Contribution, Overlay, StageAdditions } from "./contribution.ts";
import { applyFragmentText, fragmentOrder } from "./apply-fragment-text.ts";
import type { MethodFinding } from "./findings.ts";
import type { PluginId } from "./identities.ts";
import type { AuthoredBody } from "./outline.ts";
import type { CoreContent } from "./method.ts";
import type { Stage } from "./stage.ts";

type OverlayApplication = { readonly content: CoreContent;
  readonly findings: readonly MethodFinding[] };

type OwnedOverlay = { readonly plugin: PluginId; readonly overlay: Overlay };

const mergeAdditions = (stage: Stage, adds: StageAdditions): Stage => ({ ...stage,
  produces: [...stage.produces, ...adds.produces.filter((entry) =>
    !stage.produces.some((prior) => prior.artifact === entry.artifact))],
  consumes: [...stage.consumes, ...adds.consumes.filter((entry) =>
    !stage.consumes.some((prior) => prior.artifact === entry.artifact))],
  requires: [...new Set([...stage.requires, ...adds.requires])],
  sensors: [...new Set([...stage.sensors, ...adds.sensors])],
  requiredSections: [...new Set([...stage.requiredSections, ...adds.requiredSections])],
});

const missingTargets = (content: CoreContent, overlays: readonly OwnedOverlay[]):
  readonly MethodFinding[] => overlays.flatMap(({ plugin, overlay }) => {
  const found = overlay.kind === "stage"
    ? content.stages.some((stage) => stage.slug === overlay.stage)
    : content.agents.some((agent) => agent.slug === overlay.agent);
  return found ? [] : [{ kind: "overlay-dropped", plugin, target: overlay.kind,
    name: overlay.kind === "stage" ? overlay.stage : overlay.agent,
    anchor: null, reason: "missing-target" }];
});

const stageOverlays = (overlays: readonly OwnedOverlay[], name: string) =>
  overlays.flatMap((entry) => entry.overlay.kind === "stage" && entry.overlay.stage === name
    ? [{ plugin: entry.plugin, overlay: entry.overlay }] : []);

const agentOverlays = (overlays: readonly OwnedOverlay[], name: string) =>
  overlays.flatMap((entry) => entry.overlay.kind === "agent" && entry.overlay.agent === name
    ? [{ plugin: entry.plugin, overlay: entry.overlay }] : []);

const scopeAdditions = (content: CoreContent, overlays: readonly OwnedOverlay[]): {
  readonly memberships: CoreContent["memberships"]; readonly findings: readonly MethodFinding[];
} => {
  const additions = overlays.flatMap(({ plugin, overlay }) => overlay.kind === "stage"
    ? overlay.adds.scopes.map((scope) => ({ plugin, stage: overlay.stage, scope })) : []);
  const permitted = additions.map((entry) => ({ ...entry,
    admitted: content.scopes.some((scope) => scope.name === entry.scope
      && scope.owner.kind === "plugin" && scope.owner.plugin === entry.plugin)
      && content.stages.some((stage) => stage.slug === entry.stage) }));
  return { memberships: permitted.flatMap((entry) => entry.admitted
    ? content.stages.filter((stage) => stage.slug === entry.stage).map((stage) => ({
      scope: entry.scope, stage: stage.slug,
      declaredBy: { kind: "plugin" as const, plugin: entry.plugin },
    })) : []), findings: permitted.flatMap((entry) => entry.admitted ? []
    : [{ kind: "overlay-dropped", plugin: entry.plugin, target: "stage", name: entry.stage,
      anchor: null, reason: "addition-not-allowed" }]) };
};

export const applyOverlays = (request: { readonly content: CoreContent;
  readonly contributions: readonly Contribution[]; readonly outline: (text: string) => AuthoredBody }):
  OverlayApplication => {
  const overlays = request.contributions.flatMap((entry) =>
    entry.overlays.map((overlay) => ({ plugin: entry.plugin, overlay })));
  const stages = request.content.stages.map((stage) => {
    const group = stageOverlays(overlays, stage.slug);
    const fragments = group.flatMap((entry) =>
      entry.overlay.fragments.map((fragment) => ({ plugin: entry.plugin,
        target: "stage" as const, name: stage.slug, fragment })));
    const applied = applyFragmentText({ body: stage.briefing.instructions,
      fragments, outline: request.outline });
    const merged = group.reduce((prior, entry) => mergeAdditions(prior, entry.overlay.adds), stage);
    return { stage: { ...merged, briefing: { ...stage.briefing, instructions: applied.body } },
      findings: applied.findings };
  });
  const agents = request.content.agents.map((agent) => {
    const fragments = agentOverlays(overlays, agent.slug)
      .flatMap((entry) => entry.overlay.fragments.map((fragment) => ({ plugin: entry.plugin,
        target: "agent" as const, name: agent.slug, fragment }))).toSorted(fragmentOrder);
    const applied = applyFragmentText({ body: agent.persona,
      fragments: fragments.filter((entry) => entry.fragment.anchor.kind === "in-section"),
      outline: request.outline });
    return { agent: { ...agent, persona: applied.body, additions: {
      afterPreflight: [...agent.additions.afterPreflight, ...fragments.filter((entry) =>
        entry.fragment.anchor.kind === "after-preflight").map((entry) => entry.fragment.text)],
      endOfBody: [...agent.additions.endOfBody, ...fragments.filter((entry) =>
        entry.fragment.anchor.kind === "end-of-body").map((entry) => entry.fragment.text)],
    } }, findings: applied.findings };
  });
  const scopes = scopeAdditions(request.content, overlays);
  return { content: { ...request.content, stages: stages.map((entry) => entry.stage),
    agents: agents.map((entry) => entry.agent),
    memberships: [...request.content.memberships, ...scopes.memberships] }, findings: [
    ...missingTargets(request.content, overlays), ...stages.flatMap((entry) => entry.findings),
    ...agents.flatMap((entry) => entry.findings), ...scopes.findings,
  ] };
};
