import { readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { assertProjectionPathHasNoSymlinks, sha256File } from "./aidlc-distribution.ts";
import type { TransactionPlan } from "./aidlc-transaction.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function readObject(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, "utf-8"));
  if (!isRecord(value)) throw new Error(`${path}: expected a configuration object`);
  return value;
}

function stateSchemaVersion(path: string): string {
  // The engine's exported literal is the existing state-schema authority.
  // Read it without loading either mutable runtime into the installer's module
  // cache. A future non-literal declaration needs an explicit compatibility
  // update; guessing its value would turn this guard into a bypass.
  const declarations = [...readFileSync(path, "utf-8").matchAll(/^export\s+const\s+CURRENT_STATE_VERSION\s*=\s*["'](\d+)["']\s*;/gm)];
  if (declarations.length !== 1) throw new Error(`${path}: cannot establish the state schema from its exported version`);
  return declarations[0][1];
}

function stageContracts(path: string): Map<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, "utf-8"));
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path}: expected a non-empty stage graph`);
  }
  const stages = new Map<string, unknown>();
  for (const stage of value) {
    if (!isRecord(stage) || typeof stage.slug !== "string" || !stage.slug || stages.has(stage.slug)) {
      throw new Error(`${path}: invalid or duplicate stage identity`);
    }
    stages.set(stage.slug, stage);
  }
  return stages;
}

function assertRetainedContracts(
  kind: string,
  installed: ReadonlyMap<string, unknown>,
  candidate: ReadonlyMap<string, unknown>,
): void {
  for (const [name, contract] of installed) {
    if (!candidate.has(name) || canonical(candidate.get(name)) !== canonical(contract)) {
      throw new Error(`open-workflow refresh refused: ${kind} ${JSON.stringify(name)} changes or disappears; use a separately reviewed workflow migration`);
    }
  }
}

function assertWorkspaceReadOnly(plan: TransactionPlan): void {
  for (const operation of plan.operations) {
    const path = posix.normalize(operation.path.replaceAll("\\", "/"));
    if (path === "aidlc" || path.startsWith("aidlc/")) {
      throw new Error(`open-workflow refresh refused: project workspace is read-only (${path})`);
    }
  }
}

type ContractEvidence = {
  stateVersion: string;
  stages: number;
  scopes: number;
  installed: Record<string, string>;
  candidate: Record<string, string>;
};

export type CompatibleRefreshValidation = {
  evidence: ContractEvidence;
  validateLocked: () => void;
};

// This is payload refresh, never state migration. Retaining every installed
// contract (not only the current cursor's stage) lets independent workflows
// advance or start while the installer plans. Existing transaction ownership,
// expected-byte checks and rollback remain authoritative for installed files.
export function planCompatibleRefresh(args: {
  projectDir: string;
  sourceRoot: string;
  harnessDir: string;
  plan: TransactionPlan;
}): CompatibleRefreshValidation {
  if (resolve(args.plan.root) !== resolve(args.projectDir)) {
    throw new Error("open-workflow refresh requires a project-rooted transaction");
  }
  assertWorkspaceReadOnly(args.plan);
  const metadataPaths = [
    `${args.harnessDir}/tools/aidlc-lib.ts`,
    `${args.harnessDir}/tools/data/stage-graph.json`,
    `${args.harnessDir}/tools/data/scope-grid.json`,
  ];
  const hashes = (root: string): Record<string, string> => Object.fromEntries(
    metadataPaths.map((path) => {
      assertProjectionPathHasNoSymlinks(root, path);
      return [path, sha256File(join(root, path))];
    }),
  );
  const installed = hashes(args.projectDir);
  const candidate = hashes(args.sourceRoot);
  const installedVersion = stateSchemaVersion(join(args.projectDir, metadataPaths[0]));
  const candidateVersion = stateSchemaVersion(join(args.sourceRoot, metadataPaths[0]));
  if (candidateVersion !== installedVersion) {
    throw new Error("open-workflow refresh refused: installed and candidate state schemas must agree");
  }
  const installedStages = stageContracts(join(args.projectDir, metadataPaths[1]));
  const candidateStages = stageContracts(join(args.sourceRoot, metadataPaths[1]));
  const installedScopes = new Map(Object.entries(readObject(join(args.projectDir, metadataPaths[2]))));
  const candidateScopes = new Map(Object.entries(readObject(join(args.sourceRoot, metadataPaths[2]))));
  if (installedScopes.size === 0) throw new Error("open-workflow refresh refused: installed scope grid is empty");
  assertRetainedContracts("stage", installedStages, candidateStages);
  assertRetainedContracts("scope", installedScopes, candidateScopes);
  const validateLocked = (): void => {
    assertWorkspaceReadOnly(args.plan);
    if (canonical(hashes(args.projectDir)) !== canonical(installed) || canonical(hashes(args.sourceRoot)) !== canonical(candidate)) {
      throw new Error("open-workflow refresh compatibility inputs changed after planning; plan again");
    }
  };
  validateLocked();
  return {
    evidence: { stateVersion: installedVersion, stages: installedStages.size, scopes: installedScopes.size, installed, candidate },
    validateLocked,
  };
}
