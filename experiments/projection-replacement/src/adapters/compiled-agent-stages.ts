import { z } from "zod";
import type { SourceOrigin, SourceBasis } from "../domain/source-origin.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { CompiledAgentStage } from "../domain/agent-definition.ts";
import { agentStageModes } from "../domain/stage-participation.ts";
import type { CompiledAgentStageCatalogue } from "../domain/compiled-agent-stages.ts";
import { finding, sourceKey, type Outcome } from "../domain/model.ts";

const leadKey = "lead_agent";
const supportsKey = "support_agents";
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const sourceSchema = z.strictObject({ source: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("core"), id: slug }), z.strictObject({ kind: z.literal("plugin"), id: slug })]), pin: z.string().min(1) });
const stageSchema = z.object({ slug, plugin: slug.optional(), mode: z.string().min(1), [leadKey]: slug, [supportsKey]: z.array(slug), reviewer: slug.nullable().optional(), enabled: z.boolean().optional() });
const schema = z.strictObject({ stages: z.array(stageSchema), sources: z.array(sourceSchema) });
const compiledStage = ({ row, sources, artifact }: { readonly row: z.infer<typeof stageSchema>; readonly sources: readonly SourceBasis[]; readonly artifact: SourceOrigin }): Outcome<CompiledAgentStage> => {
  const owner = row.plugin === undefined || row.plugin === "aidlc" ? { kind: "core" as const, id: "framework" } : { kind: "plugin" as const, id: row.plugin };
  const definition = sources.find((basis) => sourceKey(basis.source) === sourceKey(owner));
  if (definition === undefined)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: row.slug, detail: `compiled stage owner ${sourceKey(owner)} requires an explicit source pin; the artifact pin does not establish definition provenance` })] };
  const mode = agentStageModes.find((candidate) => candidate === row.mode);
  if (mode === undefined)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: row.slug, detail: `compiled stage mode ${row.mode} is unsupported for participation; preserve the source topology` })] };
  return { status: "ok", value: { origin: { kind: "compiled", artifact, definition }, slug: row.slug, mode, lead: row[leadKey], supports: row[supportsKey], reviewer: row.reviewer ?? null } };
};
const catalogue = ({ parsed, artifact }: { readonly parsed: z.infer<typeof schema>; readonly artifact: SourceOrigin }): Outcome<CompiledAgentStageCatalogue> => {
  const duplicateStages = parsed.stages.filter((entry, index) => parsed.stages.findIndex((candidate) => candidate.slug === entry.slug) !== index).map((entry) => finding({ code: "duplicate", subject: entry.slug, detail: "compiled stage slugs must be unique, including disabled rows" }));
  const duplicateSources = parsed.sources.filter((entry, index) => parsed.sources.findIndex((candidate) => sourceKey(candidate.source) === sourceKey(entry.source)) !== index).map((entry) => finding({ code: "duplicate", subject: sourceKey(entry.source), detail: "compiled stage source bases must identify each owner once" }));
  if (duplicateStages.length > 0 || duplicateSources.length > 0) return { status: "invalid", findings: [...duplicateStages, ...duplicateSources] };
  const stages = parsed.stages.map((row) => compiledStage({ row, sources: parsed.sources, artifact }));
  const findings = stages.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (findings.length > 0) return { status: "invalid", findings };
  return { status: "ok", value: { artifact, sources: parsed.sources, stages: stages.flatMap((entry) => entry.status === "ok" ? [entry.value] : []) } };
};
export const parseCompiledAgentStages = ({ text, artifact, binding, sources }: { readonly text: string; readonly artifact: SourceOrigin; readonly binding: HarnessBinding; readonly sources: readonly SourceBasis[] }): Outcome<CompiledAgentStageCatalogue> => {
  if (artifact.source.kind !== "core" || artifact.source.id !== "framework" || artifact.path !== `${binding.directory}/tools/data/stage-graph.json`)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: artifact.path, detail: "compiled participation requires the selected harness's framework stage-graph artifact" })] };
  let decoded: unknown;
  try { decoded = JSON.parse(text); }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: artifact.path, detail: "expected compiled stage graph JSON" })] }; }
  const parsed = schema.safeParse({ stages: decoded, sources });
  if (!parsed.success)
    return { status: "invalid", findings: [finding({ code: "invalid-input", subject: artifact.path, detail: "compiled participation requires native slug, mode, lead_agent, support_agents and valid optional plugin/reviewer/enabled fields, with explicit owner source bases" })] };
  return catalogue({ parsed: parsed.data, artifact });
};
