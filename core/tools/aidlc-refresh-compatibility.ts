import { readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { z } from "zod";
import { assertProjectionPathHasNoSymlinks, sha256Bytes } from "./aidlc-distribution.ts";
import { stageRefreshContract } from "./aidlc-stage-refresh-contract.ts";
import type { TransactionPlan } from "./aidlc-transaction.ts";

type RefreshRefusalReason =
  | "transaction-root-invalid"
  | "workspace-write"
  | "metadata-unreadable"
  | "metadata-invalid"
  | "state-schema-unestablished"
  | "state-schema-changed"
  | "stage-contract-changed"
  | "scope-contract-changed"
  | "inputs-changed";

export type RefreshRefusal = {
  readonly kind: "refused";
  readonly reason: RefreshRefusalReason;
  readonly message: string;
};

type MetadataRead =
  | { readonly kind: "read"; readonly content: string; readonly hash: string }
  | RefreshRefusal;

export type RefreshMetadataReader = {
  readonly read: (args: { readonly root: string; readonly path: string }) => MetadataRead;
};

export const defaultRefreshMetadataReader = (): RefreshMetadataReader => ({
  read: ({ root, path }) => {
    try {
      assertProjectionPathHasNoSymlinks(root, path);
      const bytes = readFileSync(join(root, path));
      return { kind: "read", content: bytes.toString("utf-8"), hash: sha256Bytes(bytes) };
    } catch {
      return { kind: "refused", reason: "metadata-unreadable", message: `open-workflow refresh refused: cannot read compatibility metadata ${join(root, path)}` };
    }
  },
});

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

const stageGraphSchema = z.array(z.object({ slug: z.string().min(1) }).passthrough()).min(1)
  .refine((stages) => new Set(stages.map((stage) => stage.slug)).size === stages.length);
const scopeGridSchema = z.record(z.string(), z.unknown()).refine((scopes) => Object.keys(scopes).length > 0);

function parseJson(args: { content: string }): { kind: "parsed"; value: unknown } | RefreshRefusal {
  try {
    return { kind: "parsed", value: JSON.parse(args.content) };
  } catch {
    return { kind: "refused", reason: "metadata-invalid", message: "open-workflow refresh refused: compatibility metadata is invalid JSON" };
  }
}

type ContractSnapshot = {
  readonly kind: "read";
  readonly stateVersion: string;
  readonly stages: ReadonlyMap<string, unknown>;
  readonly scopes: ReadonlyMap<string, unknown>;
  readonly hashes: Record<string, string>;
};

function readSnapshot(args: { root: string; harnessDir: string; reader: RefreshMetadataReader }): ContractSnapshot | RefreshRefusal {
  const statePath = `${args.harnessDir}/tools/aidlc-lib.ts`;
  const stagePath = `${args.harnessDir}/tools/data/stage-graph.json`;
  const scopePath = `${args.harnessDir}/tools/data/scope-grid.json`;
  const state = args.reader.read({ root: args.root, path: statePath });
  if (state.kind === "refused") return state;
  const declarations = [...state.content.matchAll(/^export\s+const\s+CURRENT_STATE_VERSION\s*=\s*["'](\d+)["']\s*;/gm)];
  if (declarations.length !== 1) {
    return { kind: "refused", reason: "state-schema-unestablished", message: "open-workflow refresh refused: cannot establish the state schema from its exported version" };
  }
  const stages = args.reader.read({ root: args.root, path: stagePath });
  if (stages.kind === "refused") return stages;
  const stageJson = parseJson({ content: stages.content });
  if (stageJson.kind === "refused") return stageJson;
  const stageGraph = stageGraphSchema.safeParse(stageJson.value);
  if (!stageGraph.success) {
    return { kind: "refused", reason: "metadata-invalid", message: "open-workflow refresh refused: expected a non-empty stage graph with unique stage identities" };
  }
  const scopes = args.reader.read({ root: args.root, path: scopePath });
  if (scopes.kind === "refused") return scopes;
  const scopeJson = parseJson({ content: scopes.content });
  if (scopeJson.kind === "refused") return scopeJson;
  const scopeGrid = scopeGridSchema.safeParse(scopeJson.value);
  if (!scopeGrid.success) {
    return { kind: "refused", reason: "metadata-invalid", message: "open-workflow refresh refused: expected a non-empty scope grid object" };
  }
  return {
    kind: "read",
    stateVersion: declarations[0][1],
    stages: new Map(stageGraph.data.map((stage) => [stage.slug, stage])),
    scopes: new Map(Object.entries(scopeGrid.data)),
    hashes: { [statePath]: state.hash, [stagePath]: stages.hash, [scopePath]: scopes.hash },
  };
}

function workspaceRefusal(args: { plan: TransactionPlan }): RefreshRefusal | undefined {
  const path = args.plan.operations.map((operation) => posix.normalize(operation.path.replaceAll("\\", "/")))
    .find((path) => path === "aidlc" || path.startsWith("aidlc/"));
  if (path === undefined) return undefined;
  return { kind: "refused", reason: "workspace-write", message: `open-workflow refresh refused: project workspace is read-only (${path})` };
}

function retainedContractRefusal(args: {
  kind: "stage" | "scope";
  installed: ReadonlyMap<string, unknown>;
  candidate: ReadonlyMap<string, unknown>;
  equivalent: (args: { installed: unknown; candidate: unknown }) => boolean;
}): RefreshRefusal | undefined {
  const changed = [...args.installed].find(([name, contract]) => !args.candidate.has(name) || !args.equivalent({ installed: contract, candidate: args.candidate.get(name) }));
  if (changed === undefined) return undefined;
  return {
    kind: "refused",
    reason: args.kind === "stage" ? "stage-contract-changed" : "scope-contract-changed",
    message: `open-workflow refresh refused: ${args.kind} ${JSON.stringify(changed[0])} changes or disappears; use a separately reviewed workflow migration`,
  };
}

export type CompatibleRefreshValidation =
  | RefreshRefusal
  | {
      readonly kind: "planned";
      readonly evidence: {
        readonly stateVersion: string;
        readonly stages: number;
        readonly scopes: number;
        readonly installed: Record<string, string>;
        readonly candidate: Record<string, string>;
      };
      readonly validateLocked: () => { readonly kind: "validated" } | RefreshRefusal;
    };

export function planCompatibleRefresh(args: {
  projectDir: string;
  sourceRoot: string;
  harnessDir: string;
  plan: TransactionPlan;
  reader?: RefreshMetadataReader;
}): CompatibleRefreshValidation {
  if (resolve(args.plan.root) !== resolve(args.projectDir)) {
    return { kind: "refused", reason: "transaction-root-invalid", message: "open-workflow refresh requires a project-rooted transaction" };
  }
  const workspace = workspaceRefusal({ plan: args.plan });
  if (workspace) return workspace;
  const reader = args.reader ?? defaultRefreshMetadataReader();
  const installed = readSnapshot({ root: args.projectDir, harnessDir: args.harnessDir, reader });
  if (installed.kind === "refused") return installed;
  const candidate = readSnapshot({ root: args.sourceRoot, harnessDir: args.harnessDir, reader });
  if (candidate.kind === "refused") return candidate;
  if (candidate.stateVersion !== installed.stateVersion) {
    return { kind: "refused", reason: "state-schema-changed", message: "open-workflow refresh refused: installed and candidate state schemas must agree" };
  }
  const stages = retainedContractRefusal({
    kind: "stage", installed: installed.stages, candidate: candidate.stages,
    equivalent: ({ installed, candidate }) => {
      const before = stageRefreshContract({ stage: installed });
      const after = stageRefreshContract({ stage: candidate });
      return before.kind === "comparable" && after.kind === "comparable" && canonical(before.value) === canonical(after.value);
    },
  });
  if (stages) return stages;
  const scopes = retainedContractRefusal({
    kind: "scope", installed: installed.scopes, candidate: candidate.scopes,
    equivalent: ({ installed, candidate }) => canonical(installed) === canonical(candidate),
  });
  if (scopes) return scopes;
  const validateLocked = (): { kind: "validated" } | RefreshRefusal => {
    const workspace = workspaceRefusal({ plan: args.plan });
    if (workspace) return workspace;
    const currentInstalled = readSnapshot({ root: args.projectDir, harnessDir: args.harnessDir, reader });
    if (currentInstalled.kind === "refused") return currentInstalled;
    const currentCandidate = readSnapshot({ root: args.sourceRoot, harnessDir: args.harnessDir, reader });
    if (currentCandidate.kind === "refused") return currentCandidate;
    if (canonical(currentInstalled.hashes) !== canonical(installed.hashes) || canonical(currentCandidate.hashes) !== canonical(candidate.hashes)) {
      return { kind: "refused", reason: "inputs-changed", message: "open-workflow refresh compatibility inputs changed after planning; plan again" };
    }
    return { kind: "validated" };
  };
  const locked = validateLocked();
  if (locked.kind === "refused") return locked;
  return {
    kind: "planned",
    evidence: { stateVersion: installed.stateVersion, stages: installed.stages.size, scopes: installed.scopes.size, installed: installed.hashes, candidate: candidate.hashes },
    validateLocked,
  };
}
