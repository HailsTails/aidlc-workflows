import type { BaseRevision, ChangedFile } from "../domain/change.ts";
import type { ModuleShape } from "../domain/deletion.ts";
import type { GoldenSet } from "../domain/golden.ts";
import type { JsonValue } from "../domain/json-grant.ts";
import type { LanePlan } from "../domain/lane-plan.ts";
import type { MonolithShape } from "../domain/monolith.ts";
import type { CheckId, CheckOutcome } from "../domain/outcome.ts";
import type { CountsByFile } from "../domain/violation-ratchet.ts";

export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: string; readonly fix: string };

export type LanePlanSource = {
  readonly load: () => Loaded<LanePlan>;
};

export type RevisionFile = {
  readonly commit: string;
  readonly path: string;
};

export type Repository = {
  readonly resolve: (ref: string) => BaseRevision | undefined;
  readonly changesSince: (base: BaseRevision) => readonly ChangedFile[];
  readonly readAt: (file: RevisionFile) => string | undefined;
};

export type Workspace = {
  readonly read: (path: string) => string | undefined;
  readonly write: (request: { readonly path: string; readonly content: string }) => void;
  readonly filesMatching: (globs: readonly string[]) => readonly string[];
};

export type ModuleReader = {
  readonly shapeOf: (request: { readonly path: string; readonly text: string }) => ModuleShape;
};

export type JsonReader = {
  readonly parse: (text: string) => JsonValue | undefined;
};

export type LintTargets =
  | { readonly kind: "all" }
  | { readonly kind: "files"; readonly files: readonly string[] };

export type LintExamples = Readonly<Record<string, Readonly<Record<string, string>>>>;

export type LintMeasurement = {
  readonly counts: CountsByFile;
  readonly examples: LintExamples;
};

export type Linter = {
  readonly measure: (targets: LintTargets) => Promise<LintMeasurement>;
};

export type Command = {
  readonly label: string;
  readonly argv: readonly string[];
};

export type CommandResult = {
  readonly exitCode: number;
  readonly output: string;
};

export type CommandRunner = {
  readonly capture: (command: Command) => CommandResult;
  readonly attach: (command: Command) => number;
};

export type RecordSource =
  | { readonly kind: "head" }
  | { readonly kind: "base"; readonly commit: string };

export type RatchetRecords = {
  readonly globs: readonly string[];
  readonly monolithFiles: readonly string[];
  readonly boundary: (source: RecordSource) => CountsByFile | undefined;
  readonly monolith: (request: {
    readonly source: RecordSource;
    readonly file: string;
  }) => MonolithShape | undefined;
  readonly saveBoundary: (counts: CountsByFile) => void;
  readonly saveMonoliths: (shapes: readonly MonolithShape[]) => void;
};

export type NameList = {
  readonly read: () => readonly string[] | undefined;
  readonly write: (names: readonly string[]) => void;
};

export type GoldenSource = {
  readonly measure: () => GoldenSet;
};

export type GoldenStore = {
  readonly read: () => GoldenSet;
  readonly write: (set: GoldenSet) => void;
};

export type LockRequest = {
  readonly lane: string;
  readonly command: string;
  readonly waitMs: number;
};

export type MachineLock = {
  readonly acquire: (request: LockRequest) => Promise<boolean>;
  readonly release: () => void;
};

export type Progress = {
  readonly started: (id: CheckId) => void;
  readonly finished: (outcome: CheckOutcome) => void;
  readonly note: (line: string) => void;
};
