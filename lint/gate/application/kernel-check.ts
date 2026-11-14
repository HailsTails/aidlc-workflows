import {
  judgeKernelSurface,
  narrowedSurface,
  type KernelExport,
} from "../domain/kernel-surface.ts";
import { judged, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import type { ModuleReader, NameList, Workspace } from "./ports.ts";

export type KernelDependencies = {
  readonly workspace: Workspace;
  readonly modules: ModuleReader;
  readonly record: NameList;
  readonly sources: readonly string[];
};

const kernelExports = (dependencies: KernelDependencies): readonly KernelExport[] =>
  dependencies.workspace
    .filesMatching(dependencies.sources)
    .filter((file) => !file.endsWith(".test.ts"))
    .flatMap((file) => {
      const text = dependencies.workspace.read(file) ?? "";
      const { exports } = dependencies.modules.shapeOf({ path: file, text });
      return exports.map((name) => ({ file, name }));
    });

const unrecorded: Finding = {
  subject: "src/kernel",
  violation: "has no exported-names record, so its growth cannot be checked",
  fix: "Record the kernel surface with bun scripts/gate.ts --scope G --only kernel --record.",
};

export const kernelCheck = (dependencies: KernelDependencies): GateCheck => ({
  id: "kernel",
  run: async (scope) => {
    const measured = kernelExports(dependencies);
    const recorded = dependencies.record.read();
    if (scope.record) {
      dependencies.record.write(
        recorded === undefined
          ? measured.map((entry) => entry.name)
          : narrowedSurface({ recorded, measured }),
      );
    }
    const findings =
      recorded === undefined ? [unrecorded] : judgeKernelSurface({ recorded, measured });
    const note = `${measured.length} kernel exports, ${recorded?.length ?? 0} recorded`;
    return judged({ id: "kernel", findings, note });
  },
});
