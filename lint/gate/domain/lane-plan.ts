export const ANY_DECLARATION = "*";

export type DeletionGrant = {
  readonly pattern: string;
  readonly declarations: readonly string[];
};

export type HotFileGrant = {
  readonly path: string;
  readonly keyPaths: readonly string[];
};

export type Lane = {
  readonly id: string;
  readonly name: string;
  readonly owns: readonly string[];
  readonly territory: readonly string[];
  readonly notOwned: readonly string[];
  readonly deletions: readonly DeletionGrant[];
  readonly hotFileGrants: readonly HotFileGrant[];
};

export type ContractFiles = {
  readonly writer: string;
  readonly files: readonly string[];
};

export type LanePlan = {
  readonly hotFiles: readonly string[];
  readonly contracts: readonly ContractFiles[];
  readonly lanes: readonly Lane[];
};

export const laneById = (plan: LanePlan, id: string): Lane | undefined =>
  plan.lanes.find((lane) => lane.id === id);

export const grantsEveryDeclaration = (declarations: readonly string[]): boolean =>
  declarations.includes(ANY_DECLARATION);
