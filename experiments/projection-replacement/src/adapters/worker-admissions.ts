import { z } from "zod";
import type { AgentOrigin } from "../domain/agent-definition.ts";
import type { WorkerAdmissions } from "../domain/worker-policy.ts";
import { finding, type Outcome } from "../domain/model.ts";

const admissionsSchema = z.record(z.string().regex(/^[a-z][a-z0-9-]*\.ts$/), z.array(z.string().trim().min(1))).refine((verbs) => Object.keys(verbs).length > 0);
export const parseWorkerAdmissions = ({ input, origin, name }: {
  readonly input: unknown;
  readonly origin: AgentOrigin;
  readonly name: string;
}): Outcome<WorkerAdmissions> => {
  const parsed = admissionsSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: origin.path, detail: "expected a nonempty script-to-admitted-verbs map from the command admission owner" })] };
  return { status: "ok", value: { origin, name, verbs: parsed.data } };
};
