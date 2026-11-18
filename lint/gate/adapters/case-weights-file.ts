import { z } from "zod";
import type { CaseTiming } from "../domain/case-split.ts";
import type { Workspace } from "../application/ports.ts";

export const CASE_WEIGHTS_PATH = "lint/gate/case-weights.json";

const CaseWeightsSchema = z.object({
  version: z.literal(1),
  files: z.record(z.string(), z.array(z.object({ name: z.string(), seconds: z.number() }))),
});

export type CaseWeights = z.infer<typeof CaseWeightsSchema>["files"];

const NONE: CaseWeights = {};

export const readCaseWeights = (workspace: Workspace): CaseWeights => {
  const text = workspace.read(CASE_WEIGHTS_PATH);
  if (text === undefined) {
    return NONE;
  }
  const parsed = CaseWeightsSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data.files : NONE;
};

export const casesOfFile = (workspace: Workspace): ((file: string) => readonly CaseTiming[]) => {
  const files = readCaseWeights(workspace);
  return (file) => files[file] ?? [];
};

export const withRecordedCases = (request: {
  readonly existing: CaseWeights;
  readonly file: string;
  readonly cases: readonly CaseTiming[];
}): CaseWeights => ({ ...request.existing, [request.file]: [...request.cases] });

export const caseWeightsDocument = (files: CaseWeights): string =>
  `${JSON.stringify({ version: 1, files }, null, 2)}\n`;
