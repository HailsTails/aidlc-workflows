import type { ChildRuntimeDirectories } from "./child-runtime-directory.ts";
import { removeDistributionDirectory, type DistributionDirectories } from "./distribution-directory.ts";

type FreshCoreRoots = { readonly runtimeRoot: string; readonly distributionRoot: string };
type Evaluation<T> = { readonly status: "completed"; readonly value: T } | { readonly status: "failed"; readonly failure: unknown };
const releaseAllocatedRoot = ({ root, remove }: { readonly root: string | undefined; readonly remove: (root: string) => void }): readonly unknown[] => {
  if (root === undefined) return [];
  try { remove(root); return []; }
  catch (failure) { return [failure]; }
};
const finishEvaluation = <T>({ evaluation, failures }: { readonly evaluation: Evaluation<T>; readonly failures: readonly unknown[] }): T => {
  if (evaluation.status === "failed") {
    if (failures.length === 0) throw evaluation.failure;
    throw new AggregateError([evaluation.failure, ...failures], "Fresh core session and cleanup failed");
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Fresh core session cleanup failed");
  return evaluation.value;
};

// These independent parent leases bound one fresh realm; neither owns its transport directory.
export const withFreshCoreDirectories = async <T>({ runtimeDirectories, distributionDirectories, consume }: { readonly runtimeDirectories: ChildRuntimeDirectories; readonly distributionDirectories: DistributionDirectories; readonly consume: (roots: FreshCoreRoots) => Promise<T> }): Promise<T> => {
  let runtimeRoot: string | undefined, distributionRoot: string | undefined;
  let evaluation: Evaluation<T>;
  try {
    runtimeRoot = runtimeDirectories.allocate();
    distributionRoot = distributionDirectories.allocate();
    evaluation = { status: "completed", value: await consume({ runtimeRoot, distributionRoot }) };
  } catch (failure) { evaluation = { status: "failed", failure }; }
  const failures = [
    ...releaseAllocatedRoot({ root: distributionRoot, remove: root => removeDistributionDirectory({ directories: distributionDirectories, root }) }),
    ...releaseAllocatedRoot({ root: runtimeRoot, remove: root => runtimeDirectories.remove({ root }) }),
  ];
  return finishEvaluation({ evaluation, failures });
};
