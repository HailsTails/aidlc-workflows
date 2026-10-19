import type { RunnerClause } from "../mechanism-port/runner-module-schema.ts";
import type { ClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";

export type SelectedClause = {
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
};

export type Selection = {
  readonly selected: readonly SelectedClause[];
  readonly uncovered: readonly ClauseAddress[];
};

export type ClauseBinding = {
  readonly mechanism: MechanismId;
  readonly clause: RunnerClause;
};

export type SelectionReading = {
  readonly selection: Selection;
  readonly bindings: readonly ClauseBinding[];
};
