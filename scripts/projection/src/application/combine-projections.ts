import type { ProjectionSet } from "./projection-set.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import { collectNativeFiles } from "../domain/native-file-set.ts";
import { finding, type Outcome } from "../domain/model.ts";
export type ProjectionCombinationRules = { readonly collect: typeof collectNativeFiles };
export const createProjectionCombinationRules = (): ProjectionCombinationRules => ({ collect: collectNativeFiles });
export const combineProjectionSets = ({ target, sets, rules = createProjectionCombinationRules() }: { readonly target: HarnessBinding; readonly sets: readonly ProjectionSet[]; readonly rules?: ProjectionCombinationRules }): Outcome<ProjectionSet> => {
  if (sets.length === 0 || sets.some((projection) => projection.target.harness !== target.harness || projection.target.directory !== target.directory)) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "projection-composition", detail: "combine nonempty prepared projections for one exact harness binding" })] };
  const units = sets.flatMap((projection) => projection.units);
  if (new Set(units.map((unit) => unit.key)).size !== units.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "projection-composition", detail: "prepared projection unit identities must be unique across contributors" })] };
  const resources = rules.collect({ resources: sets.flatMap((projection) => projection.resources) });
  return resources.status === "invalid" ? resources : { status: "ok", value: { scope: "selected-surfaces", target, units, resources: resources.value } };
};
