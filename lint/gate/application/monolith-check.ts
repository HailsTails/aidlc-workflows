import { countLines, judgeMonolith, shrunkRecord, type MonolithShape } from "../domain/monolith.ts";
import { judged, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import type { ModuleReader, RatchetRecords, Workspace } from "./ports.ts";

export type MonolithDependencies = {
  readonly records: RatchetRecords;
  readonly workspace: Workspace;
  readonly modules: ModuleReader;
  readonly memberTypes?: Readonly<Record<string, readonly string[]>>;
};

type Pair = {
  readonly file: string;
  readonly recorded: MonolithShape | undefined;
  readonly measured: MonolithShape;
};

const measure = (dependencies: MonolithDependencies, file: string): MonolithShape => {
  const text = dependencies.workspace.read(file) ?? "";
  const { declarations } = dependencies.modules.shapeOf({ path: file, text });
  const members = (dependencies.memberTypes?.[file] ?? []).flatMap((type) =>
    dependencies.modules.membersOf({ path: file, text, type }).map((member) => `${type}.${member}`),
  );
  return { file, declarations: [...declarations, ...members], lines: countLines(text) };
};

const unrecorded = (file: string): Finding => ({
  subject: file,
  violation: "has no monolith record, so its growth cannot be checked",
  fix: "Record the monolith with bun scripts/gate.ts --scope G --only monolith --record.",
});

const judge = (pair: Pair): readonly Finding[] =>
  pair.recorded === undefined
    ? [unrecorded(pair.file)]
    : judgeMonolith({ recorded: pair.recorded, measured: pair.measured });

const nextRecord = (pair: Pair): MonolithShape =>
  pair.recorded === undefined
    ? pair.measured
    : shrunkRecord({ recorded: pair.recorded, measured: pair.measured });

const noteFor = (pairs: readonly Pair[]): string =>
  pairs
    .map(({ file, recorded, measured }) => `${file} ${measured.lines}/${recorded?.lines ?? "?"}`)
    .join(", ");

export const monolithCheck = (dependencies: MonolithDependencies): GateCheck => ({
  id: "monolith",
  run: async (scope) => {
    const { records } = dependencies;
    const pairs = records.monolithFiles.map((file) => ({
      file,
      recorded: records.monolith({ source: { kind: "head" }, file }),
      measured: measure(dependencies, file),
    }));
    if (scope.record) {
      records.saveMonoliths(pairs.map(nextRecord));
    }
    const findings = pairs.flatMap(judge);
    return judged({ id: "monolith", findings, note: `lines now/recorded: ${noteFor(pairs)}` });
  },
});
