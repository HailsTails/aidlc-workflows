import { z } from "zod";
import { finding, pathStatus, sourceKey, type Outcome } from "../domain/model.ts";
import { roleActorKey, type PluginRoleContract, type RoleActor } from "../domain/plugin-role-contract.ts";
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/), sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const source = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("core"), id: slug }), z.strictObject({ kind: z.literal("plugin"), id: slug })]);
const basis = z.strictObject({ source, pin: z.string().min(1) }), origin = basis.extend({ path: z.string().refine((path) => pathStatus({ path }) === "safe") });
const actor = z.strictObject({ name: slug, origin, sha256 });
const schema = z.strictObject({ version: z.literal(1), owner: z.strictObject({ source: z.strictObject({ kind: z.literal("plugin"), id: slug }), pin: z.string().min(1) }), sources: z.array(basis).min(1), frontend: z.strictObject({ origin, inputs: z.array(z.strictObject({ path: z.string().refine((path) => pathStatus({ path }) === "safe"), sha256 })).min(1) }), stages: z.array(z.strictObject({ origin, sha256, slug, mode: slug, roles: z.strictObject({ lead: actor, supports: z.array(actor), reviewer: actor.nullable() }) })).min(1) });
const contractFindings = ({ contract }: { readonly contract: PluginRoleContract }): Outcome<PluginRoleContract> => {
  const actors: readonly RoleActor[] = contract.stages.flatMap((stage) => [stage.roles.lead, ...stage.roles.supports, ...(stage.roles.reviewer === null ? [] : [stage.roles.reviewer])]);
  if (contract.owner.source.kind !== "plugin" || new Set(contract.sources.map((source) => sourceKey(source.source))).size !== contract.sources.length || !contract.sources.some((source) => sourceKey(source.source) === sourceKey(contract.owner.source) && source.pin === contract.owner.pin) || contract.stages.some((stage) => sourceKey(stage.origin.source) !== sourceKey(contract.owner.source) || stage.origin.pin !== contract.owner.pin) || actors.some((actor) => !contract.sources.some((source) => sourceKey(source.source) === sourceKey(actor.origin.source) && source.pin === actor.origin.pin))) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-roles", detail: "portable role references must bind to one exact declared source basis per owner" })] };
  if (new Set(contract.stages.map((stage) => stage.slug)).size !== contract.stages.length || new Set(contract.stages.map((stage) => stage.origin.path)).size !== contract.stages.length || actors.some((actor) => actors.some((other) => other.name === actor.name && roleActorKey({ actor: other }) !== roleActorKey({ actor })))) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "plugin-roles", detail: "portable stage identities must be unique and each global agent name must resolve to one source reference" })] };
  if (new Set(contract.frontend.inputs.map((input) => input.path)).size !== contract.frontend.inputs.length || !contract.frontend.inputs.some((input) => input.path === contract.frontend.origin.path)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-roles", detail: "frontend provenance must witness its declared entrypoint once without duplicate paths" })] };
  return { status: "ok", value: contract };
};
export type PluginRoleCodec = { readonly read: (input: { readonly json: string }) => Outcome<PluginRoleContract>; readonly write: (input: { readonly contract: PluginRoleContract }) => string };
export const createPluginRoleCodec = (): PluginRoleCodec => ({
  write: ({ contract }) => JSON.stringify(contract, null, 2) + "\n",
  read: ({ json }) => {
    try { const parsed = schema.safeParse(JSON.parse(json)); return parsed.success ? contractFindings({ contract: parsed.data }) : { status: "invalid", findings: [finding({ code: "invalid-input", subject: "plugin-roles", detail: "portable roles require versioned source identities, stage topology, input digests and role references; capabilities and permissions are not accepted fields" })] }; }
    catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "plugin-roles", detail: "portable role contract must contain valid JSON" })] }; }
  },
});
