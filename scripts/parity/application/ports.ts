import type { GoldenSet } from "../domain/golden.ts";
import type { FileTree, LifecycleRecord } from "../domain/install-lifecycle.ts";

export type Workspace = {
  readonly read: (path: string) => string | undefined;
  readonly write: (request: { readonly path: string; readonly content: string }) => void;
  readonly filesMatching: (globs: readonly string[]) => readonly string[];
};

export type GoldenSource = {
  readonly measure: () => GoldenSet;
};

export type GoldenStore = {
  readonly read: () => GoldenSet;
  readonly write: (set: GoldenSet) => void;
};

export type RuntimeChoice = "current" | "previous";

export type ConfigRun = {
  readonly exitCode: number;
  readonly output: string;
};

export type ConfigRequest = {
  readonly runtime: RuntimeChoice;
  readonly force: boolean;
};

export type InstallProject = {
  readonly copyIn: (runtime: RuntimeChoice) => void;
  readonly config: (request: ConfigRequest) => ConfigRun;
  readonly ownedSample: () => string;
  readonly append: (path: string) => void;
  readonly tree: () => FileTree;
};

export type InstallLab = {
  readonly releaseOf: (runtime: RuntimeChoice) => string;
  readonly project: (harness: string) => InstallProject;
};

export type LifecycleFixtures = {
  readonly harnesses: () => readonly string[];
  readonly read: (harness: string) => LifecycleRecord | undefined;
  readonly write: (record: LifecycleRecord) => void;
};
