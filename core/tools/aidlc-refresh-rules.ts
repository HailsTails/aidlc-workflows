import type { Buffer } from "node:buffer";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sha256Bytes } from "./aidlc-distribution.ts";
import { loadRules } from "./aidlc-graph.ts";
import type { RefreshRefusal } from "./aidlc-refresh-compatibility.ts";

type RuleInput = { readonly path: string; readonly bytes: Buffer };
export type RefreshRuleFilesystem = {
  readonly read: (args: { readonly root: string }) => readonly RuleInput[];
  readonly write: (args: { readonly root: string; readonly path: string; readonly bytes: Buffer }) => void;
  readonly remove: (args: { readonly root: string; readonly path: string }) => void;
  readonly digest: (args: { readonly bytes: Buffer }) => string;
};
export type RefreshRuleInputs = {
  readonly evidence: Readonly<Record<string, string>>;
  readonly validateLocked: () => { readonly kind: "validated" } | RefreshRefusal;
};

const defaultRuleFilesystem = (): RefreshRuleFilesystem => ({
  read: ({ root }) => loadRules({ projectDir: root }).map(({ path }) => ({
    path, bytes: readFileSync(join(root, path)),
  })),
  write: ({ root, path, bytes }) => {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  },
  remove: ({ root, path }) => { rmSync(join(root, path)); },
  digest: ({ bytes }) => sha256Bytes(bytes),
});

const ruleInputEvidence = (args: { readonly files: readonly RuleInput[]; readonly filesystem: RefreshRuleFilesystem }): Readonly<Record<string, string>> =>
  Object.fromEntries([...args.files].sort((before, after) => before.path.localeCompare(after.path))
    .map(({ path, bytes }) => [path, args.filesystem.digest({ bytes })]));

type RuleProjection = {
  readonly stagedRoot: string;
  readonly workspaceMode: "seed" | "read-only";
};
export type CapturedRefreshRuleInputs = RefreshRuleInputs & {
  readonly materialize: (args: RuleProjection) => void;
};

export const captureRefreshRuleInputs = (args: {
  readonly projectDir: string;
  readonly filesystem?: RefreshRuleFilesystem;
}): CapturedRefreshRuleInputs => {
  const filesystem = args.filesystem ?? defaultRuleFilesystem();
  const retained = filesystem.read({ root: args.projectDir });
  const evidence = ruleInputEvidence({ files: retained, filesystem });
  const retainedPaths = new Set(retained.map(({ path }) => path));
  const materialize = (projection: RuleProjection): void => {
    if (projection.workspaceMode === "read-only") {
      filesystem.read({ root: projection.stagedRoot })
        .filter(({ path }) => !retainedPaths.has(path))
        .forEach(({ path }) => { filesystem.remove({ root: projection.stagedRoot, path }); });
    }
    retained.forEach(({ path, bytes }) => { filesystem.write({ root: projection.stagedRoot, path, bytes }); });
  };
  const validateLocked = (): { readonly kind: "validated" } | RefreshRefusal => {
    try {
      const current = ruleInputEvidence({ files: filesystem.read({ root: args.projectDir }), filesystem });
      if (JSON.stringify(current) === JSON.stringify(evidence)) return { kind: "validated" };
    } catch {
      return { kind: "refused", reason: "inputs-changed", message: "refresh rule authoring inputs became unreadable after preparation; plan again" };
    }
    return { kind: "refused", reason: "inputs-changed", message: "refresh rule authoring inputs changed after preparation; plan again" };
  };
  return { evidence, validateLocked, materialize };
};

export const prepareRefreshRuleInputs = (args: {
  readonly projectDir: string;
  readonly stagedRoot: string;
  readonly workspaceMode: "seed" | "read-only";
  readonly filesystem?: RefreshRuleFilesystem;
}): RefreshRuleInputs => {
  const captured = captureRefreshRuleInputs({ projectDir: args.projectDir, filesystem: args.filesystem });
  captured.materialize({ stagedRoot: args.stagedRoot, workspaceMode: args.workspaceMode });
  return captured;
};
