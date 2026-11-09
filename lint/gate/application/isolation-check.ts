import {
  judgeIsolation,
  narrowedOffenders,
  offendersOf,
  type ImplementerFiles,
  type SourceGraph,
} from "../domain/isolation.ts";
import { judged, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import type { ModuleReader, NameList, Workspace } from "./ports.ts";

export type IsolationDependencies = {
  readonly workspace: Workspace;
  readonly modules: ModuleReader;
  readonly record: NameList;
  readonly implementers: () => readonly ImplementerFiles[];
  readonly sources: readonly string[];
};

const graphOf = (dependencies: IsolationDependencies): SourceGraph =>
  new Map(
    dependencies.workspace.filesMatching(dependencies.sources).map((file) => {
      const text = dependencies.workspace.read(file) ?? "";
      return [file, dependencies.modules.referencesOf({ path: file, text })] as const;
    }),
  );

const unrecorded: Finding = {
  subject: "src",
  violation: "has no isolation record, so new offenders cannot be told from old ones",
  fix: "Record the offenders with bun scripts/gate.ts --scope G --only isolation --record.",
};

export const isolationCheck = (dependencies: IsolationDependencies): GateCheck => ({
  id: "isolation",
  run: async (scope) => {
    const measured = offendersOf({
      graph: graphOf(dependencies),
      implementers: dependencies.implementers(),
    });
    const recorded = dependencies.record.read();
    if (scope.record) {
      dependencies.record.write(
        recorded === undefined ? measured : narrowedOffenders({ recorded, measured }),
      );
    }
    const findings =
      recorded === undefined ? [unrecorded] : judgeIsolation({ recorded, measured });
    const note = `${measured.length} offenders, ${recorded?.length ?? 0} recorded`;
    return judged({ id: "isolation", findings, note });
  },
});
