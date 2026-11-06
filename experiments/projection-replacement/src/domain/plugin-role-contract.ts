import type { AuthoredAgent, AuthoredAgentStage } from "./agent-definition.ts";
import type { SourceBasis, SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import { agentStageModes } from "./stage-participation.ts";
import { finding, sourceKey, type Outcome } from "./model.ts";
export type RoleActor = { readonly name: string; readonly origin: SourceOrigin; readonly sha256: string };
export type RoleActorSource = { readonly agent: AuthoredAgent; readonly sha256: string };
export type DeclaredStageRoles = { readonly origin: SourceOrigin; readonly sha256: string; readonly slug: string; readonly mode: string; readonly lead: string; readonly supports: readonly string[]; readonly reviewer: string | null };
export type RoleFrontend = { readonly origin: SourceOrigin; readonly inputs: readonly SourceContentDigest[] };
export type PluginRoleStage = Omit<DeclaredStageRoles, "lead" | "supports" | "reviewer"> & { readonly roles: { readonly lead: RoleActor; readonly supports: readonly RoleActor[]; readonly reviewer: RoleActor | null } };
export type PluginRoleBasis = SourceBasis & { readonly source: { readonly kind: "plugin"; readonly id: string } };
export type PluginRoleContract = { readonly version: 1; readonly owner: PluginRoleBasis; readonly sources: readonly SourceBasis[]; readonly frontend: RoleFrontend; readonly stages: readonly PluginRoleStage[] };
export const roleActorKey = ({ actor }: { readonly actor: RoleActor }): string => JSON.stringify([sourceKey(actor.origin.source), actor.origin.pin, actor.origin.path, actor.name, actor.sha256]);
const originIdentity = ({ origin }: { readonly origin: SourceOrigin }): string => JSON.stringify([sourceKey(origin.source), origin.pin, origin.path]);
const actorReference = ({ name, actors }: { readonly name: string; readonly actors: readonly RoleActorSource[] }): Outcome<RoleActor> => {
  const matches = actors.filter((actor) => actor.agent.name === name);
  const matched = matches[0];
  if (matches.length !== 1 || matched === undefined) return { status: "invalid", findings: [finding({ code: matches.length === 0 ? "capability-gap" : "duplicate", subject: name, detail: "a declared role requires exactly one authored agent identity in the explicitly selected source catalogue" })] };
  return { status: "ok", value: { name, origin: matched.agent.origin, sha256: matched.sha256 } };
};
const bindStage = ({ stage, actors }: { readonly stage: DeclaredStageRoles; readonly actors: readonly RoleActorSource[] }): Outcome<PluginRoleStage> => {
  const lead = actorReference({ name: stage.lead, actors }), supports = stage.supports.map((name) => actorReference({ name, actors })), reviewer = stage.reviewer === null ? null : actorReference({ name: stage.reviewer, actors });
  const findings = [...(lead.status === "invalid" ? lead.findings : []), ...supports.flatMap((support) => support.status === "invalid" ? support.findings : []), ...(reviewer?.status === "invalid" ? reviewer.findings : [])];
  if (lead.status === "invalid" || reviewer?.status === "invalid" || findings.length > 0) return { status: "invalid", findings };
  return { status: "ok", value: { origin: stage.origin, sha256: stage.sha256, slug: stage.slug, mode: stage.mode, roles: { lead: lead.value, supports: supports.flatMap((support) => support.status === "ok" ? [support.value] : []), reviewer: reviewer?.value ?? null } } };
};
export const createPluginRoleContract = ({ owner, sources, frontend, stages, actors }: { readonly owner: SourceBasis; readonly sources: readonly SourceBasis[]; readonly frontend: RoleFrontend; readonly stages: readonly DeclaredStageRoles[]; readonly actors: readonly RoleActorSource[] }): Outcome<PluginRoleContract> => {
  if (owner.source.kind !== "plugin" || sources.filter((source) => sourceKey(source.source) === sourceKey(owner.source) && source.pin === owner.pin).length !== 1 || new Set(sources.map((source) => sourceKey(source.source))).size !== sources.length || actors.some((actor) => !sources.some((source) => sourceKey(source.source) === sourceKey(actor.agent.origin.source) && source.pin === actor.agent.origin.pin)) || stages.some((stage) => sourceKey(stage.origin.source) !== sourceKey(owner.source) || stage.origin.pin !== owner.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-roles", detail: "declare one exact source basis per selected owner and bind every stage and authored agent to those sources" })] };
  if (stages.length === 0 || new Set(stages.map((stage) => stage.slug)).size !== stages.length || new Set(stages.map((stage) => stage.origin.path)).size !== stages.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "plugin-roles", detail: "select nonempty uniquely identified plugin stages" })] };
  const bound = stages.map((stage) => bindStage({ stage, actors })), findings = bound.flatMap((stage) => stage.status === "invalid" ? stage.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { version: 1, owner: { source: owner.source, pin: owner.pin }, sources, frontend, stages: bound.flatMap((stage) => stage.status === "ok" ? [stage.value] : []) } };
};
export type RoleUse = { readonly stage: SourceOrigin; readonly slug: string; readonly mode: string; readonly role: "lead" | "support" | "reviewer"; readonly actor: RoleActor; readonly requirement: "persona" | "native-surface" };
export const pluginRoleUses = ({ contract }: { readonly contract: PluginRoleContract }): readonly RoleUse[] => contract.stages.flatMap((stage): readonly RoleUse[] => [
  { stage: stage.origin, slug: stage.slug, mode: stage.mode, role: "lead", actor: stage.roles.lead, requirement: stage.mode === "inline" ? "persona" : "native-surface" },
  ...stage.roles.supports.map((actor) => ({ stage: stage.origin, slug: stage.slug, mode: stage.mode, role: "support" as const, actor, requirement: stage.mode === "inline" ? "persona" as const : "native-surface" as const })),
  ...(stage.roles.reviewer === null ? [] : [{ stage: stage.origin, slug: stage.slug, mode: stage.mode, role: "reviewer" as const, actor: stage.roles.reviewer, requirement: "native-surface" as const }]),
]);
export const bindPluginRoleAgent = ({ contract, actor }: { readonly contract: PluginRoleContract; readonly actor: RoleActorSource }): Outcome<readonly AuthoredAgentStage[]> => {
  const uses = pluginRoleUses({ contract }).filter((use) => use.actor.name === actor.agent.name);
  if (uses.length === 0) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: actor.agent.name, detail: "agent is not referenced by this plugin role contract" })] };
  if (uses.some((use) => originIdentity({ origin: use.actor.origin }) !== originIdentity({ origin: actor.agent.origin }) || use.actor.sha256 !== actor.sha256)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: actor.agent.name, detail: "portable role identity must match the exact authored agent source, pin, path and input digest before preparation" })] };
  const stages = contract.stages.filter((stage) => uses.some((use) => use.slug === stage.slug));
  if (stages.some((stage) => !agentStageModes.some((mode) => mode === stage.mode))) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: actor.agent.name, detail: "authored topology is preserved but unsupported by current agent participation; no mode was substituted" })] };
  return { status: "ok", value: stages.flatMap((stage) => { const mode = agentStageModes.find((candidate) => candidate === stage.mode); return mode === undefined ? [] : [{ origin: stage.origin, slug: stage.slug, mode, lead: stage.roles.lead.name, supports: stage.roles.supports.map((support) => support.name), reviewer: stage.roles.reviewer?.name ?? null }]; }) };
};
