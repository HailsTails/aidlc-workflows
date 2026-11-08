import {
  changeBetween,
  lifecycleDrift,
  type FileTree,
  type LifecycleRecord,
  type StepResult,
} from "../domain/install-lifecycle.ts";
import type { Finding } from "../domain/outcome.ts";
import type { InstallLab, InstallProject, LifecycleFixtures, RuntimeChoice } from "./ports.ts";

const CURRENT: { readonly runtime: RuntimeChoice; readonly force: boolean } = {
  runtime: "current",
  force: false,
};

const stepFrom = (project: InstallProject, request: typeof CURRENT) => ({
  after: (before: FileTree): StepResult => {
    const run = project.config(request);
    return { exitCode: run.exitCode, change: changeBetween(before, project.tree()) };
  },
});

const upgradeOf = (lab: InstallLab, harness: string) => ({
  over: (freshTree: FileTree): LifecycleRecord["upgrade"] => {
    const project = lab.project(harness);
    project.copyIn("previous");
    const previous = project.config({ runtime: "previous", force: false });
    const upgraded = project.config(CURRENT);
    const change = changeBetween(freshTree, project.tree());
    return { exitCode: upgraded.exitCode, change, previousExitCode: previous.exitCode };
  },
});

export const recordLifecycle = (lab: InstallLab, harness: string): LifecycleRecord => {
  const project = lab.project(harness);
  project.copyIn("current");
  const fresh = project.config(CURRENT);
  const freshTree = project.tree();
  const refresh = stepFrom(project, CURRENT).after(freshTree);
  const file = project.ownedSample();
  project.append(file);
  const editedTree = project.tree();
  const refused = project.config(CURRENT);
  const localEdit = {
    exitCode: refused.exitCode,
    change: changeBetween(editedTree, project.tree()),
    file,
    named: refused.output.includes(file),
  };
  const force = stepFrom(project, { ...CURRENT, force: true }).after(freshTree);
  return {
    harness,
    release: lab.releaseOf("current"),
    previousRelease: lab.releaseOf("previous"),
    fresh: { exitCode: fresh.exitCode, tree: freshTree },
    refresh,
    localEdit,
    force,
    upgrade: upgradeOf(lab, harness).over(freshTree),
  };
};

const unrecorded = (harness: string): Finding => ({
  subject: harness,
  violation: "has no recorded install lifecycle",
  fix: "Record it with bun lint/gate/install-lifecycle.ts --record, then review and commit.",
});

export const checkLifecycles = (lab: InstallLab, fixtures: LifecycleFixtures): readonly Finding[] =>
  fixtures.harnesses().flatMap((harness) => {
    const expected = fixtures.read(harness);
    return expected === undefined
      ? [unrecorded(harness)]
      : lifecycleDrift({ label: harness, expected, actual: recordLifecycle(lab, harness) });
  });

export const recordLifecycles = (lab: InstallLab, fixtures: LifecycleFixtures): readonly string[] =>
  fixtures.harnesses().map((harness) => {
    fixtures.write(recordLifecycle(lab, harness));
    return harness;
  });
