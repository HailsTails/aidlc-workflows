import { z } from "zod";
import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import { finding, type Outcome } from "../domain/model.ts";
const stage = z.object({ slug: z.string().regex(/^[a-z][a-z0-9-]*$/), phase: z.enum(["initialization", "ideation", "inception", "construction", "operation"]) });
const declarations = z.array(stage).min(1);
export const parseStageDocumentRequirements = ({ seed }: { readonly seed: DistributionSeed }): Outcome<readonly string[]> => {
  const path = `${seed.binding.directory}/tools/data/stage-graph.json`;
  const graph = seed.files.find((file) => file.path === path);
  if (graph === undefined) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: path, detail: "stage document dependencies require the runtime's compiled graph" })] };
  let decoded: unknown;
  try { decoded = JSON.parse(new TextDecoder().decode(graph.bytes)); }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: path, detail: "stage document dependencies require valid compiled graph JSON" })] }; }
  const parsed = declarations.safeParse(decoded);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: path, detail: "stage document dependencies require canonical native phase/slug declarations; unsupported rows were not dropped" })] };
  if (new Set(parsed.data.map((entry) => entry.slug)).size !== parsed.data.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: path, detail: "compiled stage dependency slugs must be globally unique" })] };
  return { status: "ok", value: parsed.data.map((entry) => `${seed.binding.directory}/aidlc-common/stages/${entry.phase}/${entry.slug}.md`) };
};
