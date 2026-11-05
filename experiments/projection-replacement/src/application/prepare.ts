import { z } from "zod";
import { finding, type Outcome, type ProjectionRequest } from "../domain/model.ts";
import { prepare } from "../domain/preparation.ts";
import { project, type ProjectedDocument } from "../domain/projection.ts";
import { collectProjectionOutcomes } from "./projection-outcomes.ts";
const slug = z.string();
const path = z.string();
const source = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("core"), id: slug }),
  z.strictObject({ kind: z.literal("plugin"), id: slug }),
]);
const tier = z.enum(["templated", "balanced", "judgment"]);
const nativeTier = z.strictObject({
  model: z.string().nullable(),
  effort: z.string().nullable(),
});
const requestSchema = z.strictObject({
  documents: z.array(
    z.strictObject({
      source,
      id: slug,
      kind: z.enum(["agent", "text", "asset"]),
      body: z.string(),
      description: z.string().nullable(),
      tier: tier.nullable(),
      knowledge: z.array(slug),
      hook: z.strictObject({ event: z.literal("session-start"), command: z.string() }).nullable(),
    }),
  ),
  selectedPlugins: z.array(slug),
  knowledge: z.array(z.strictObject({ source, id: slug, body: z.string() })),
  reviewers: z.array(z.strictObject({ source, document: slug, knowledge: z.array(slug) })),
  contract: z.strictObject({
    version: z.literal(1),
    harness: slug,
    harnessDir: path,
    rulesSubdir: path,
    invocation: z.string(),
    memoryRoot: path,
    capabilities: z.array(z.enum(["agents", "knowledge", "hooks"])),
    tiers: z.strictObject({ templated: nativeTier, balanced: nativeTier, judgment: nativeTier }),
    tierCap: tier,
  }),
});
export const parseProjectionRequest = ({
  input,
}: {
  readonly input: unknown;
}): Outcome<ProjectionRequest> => {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid",
      findings: parsed.error.issues.map((issue) =>
        finding({
          code: "invalid-input",
          subject: issue.path.join("."),
          detail: issue.message,
        }),
      ),
    };
  return { status: "ok", value: parsed.data };
};
export const prepareAndProject = ({
  input,
}: {
  readonly input: unknown;
}): Outcome<readonly ProjectedDocument[]> => {
  const parsed = parseProjectionRequest({ input });
  if (parsed.status === "invalid") return parsed;
  const prepared = prepare(parsed.value);
  if (prepared.status === "invalid") return prepared;
  const outcomes = prepared.value.map(project);
  return collectProjectionOutcomes({ outcomes });
};
