import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { assertProjectionPathHasNoSymlinks, sha256Bytes } from "./aidlc-distribution.ts";
import { getField, intentsRegistryPath, runningWorkflows, stateFilePath, workflowDisplayName } from "./aidlc-lib.ts";
import { validateTransactionPlan, type TransactionOptions, type TransactionPlan } from "./aidlc-transaction.ts";
import { mutatesWorkflowWorkspace, refreshOperationsOverlap, refreshPath, resultingFile } from "./aidlc-refresh-resulting-view.ts";
import { assessWorkflowRefresh, sameContractValue, type OpenWorkflowStage, type WorkflowContractSnapshot, type WorkflowRefreshPolicy } from "./aidlc-workflow-refresh-contract.ts";

const hash = (text: string): string => sha256Bytes(Buffer.from(text, "utf8"));
const posix = (path: string): string => path.replaceAll("\\", "/");
const sameRoot = (left: string, right: string): boolean => realpathSync(resolve(left)) === realpathSync(resolve(right));
const unproved = (detail: string): never => { throw new Error(`The selected refresh policy cannot establish compatibility: ${detail}. Review the change before refreshing this open work.`); };

const read = (root: string, path: string, optional = false): string | null => {
  assertProjectionPathHasNoSymlinks(root, path);
  const target = join(root, path);
  const stat = lstatSync(target, { throwIfNoEntry: false });
  if (!stat && optional) return null;
  if (!stat?.isFile()) return unproved(`${path} is missing or not a regular file`);
  const bytes = readFileSync(target);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) return unproved(`${path} is not losslessly readable UTF-8`);
  return text;
};
const directory = (root: string, path: string): readonly string[] | null => {
  assertProjectionPathHasNoSymlinks(root, path);
  const target = join(root, path);
  const stat = lstatSync(target, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isDirectory()) return unproved(`${path} is not a directory`);
  return readdirSync(target).sort();
};
const snapshotWorkspaceInputs = (projectDir: string): { readonly hashes: Readonly<Record<string, string | null>>; readonly open: readonly OpenWorkflowStage[] } => {
  const hashes: Record<string, string | null> = {};
  const saveFile = (path: string): string | null => {
    const value = read(projectDir, path, true);
    hashes[path] = value === null ? null : hash(value);
    return value;
  };
  const saveDirectory = (path: string): readonly string[] | null => {
    const all = directory(projectDir, path);
    const names = path.endsWith("/intents") ? all?.filter((name) => !name.startsWith(".")) ?? null : all;
    hashes[`${path}/`] = names === null ? null : hash(JSON.stringify(names));
    return names;
  };
  const rules = (path: string): void => {
    for (const name of saveDirectory(path) ?? []) {
      const child = `${path}/${name}`;
      assertProjectionPathHasNoSymlinks(projectDir, child);
      const stat = lstatSync(join(projectDir, child));
      if (stat.isDirectory()) rules(child);
      else saveFile(child);
    }
  };
  // Composed scope records are authoritative inputs to payload compilation.
  rules("aidlc/scopes");
  for (const space of saveDirectory("aidlc/spaces") ?? []) {
    const root = `aidlc/spaces/${space}`;
    assertProjectionPathHasNoSymlinks(projectDir, root);
    if (!lstatSync(join(projectDir, root)).isDirectory()) continue;
    rules(`${root}/memory`);
    const registry = posix(relative(projectDir, intentsRegistryPath(projectDir, space)));
    const text = saveFile(registry);
    if (text !== null && text.trim() !== "") {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return unproved(`${registry} is not a readable work list`); }
      if (!Array.isArray(parsed)) return unproved(`${registry} is not a work list`);
    }
    // The shared query owns workflow membership. This scan only establishes
    // readable inputs before that query's forgiving absent-file fallbacks.
    for (const name of saveDirectory(`${root}/intents`) ?? []) {
      const record = `${root}/intents/${name}`;
      assertProjectionPathHasNoSymlinks(projectDir, record);
      if (lstatSync(join(projectDir, record)).isDirectory() && !name.startsWith(".")) saveFile(`${record}/aidlc-state.md`);
    }
  }
  const open = runningWorkflows(projectDir).map((workflow): OpenWorkflowStage => {
    const path = posix(relative(projectDir, stateFilePath(projectDir, workflow.dirName, workflow.space)));
    const state = saveFile(path);
    if (state === null) return unproved(`${path} is needed to establish the open work`);
    return { workflow: workflowDisplayName(workflow.space, workflow), currentStage: getField(state, "Current Stage") };
  });
  return { hashes, open };
};

const metadataPaths = (harnessDir: string): readonly string[] => [
  `${harnessDir}/tools/aidlc-lib.ts`, `${harnessDir}/tools/data/stage-graph.json`, `${harnessDir}/tools/data/scope-grid.json`,
];
type Metadata = { readonly contract: WorkflowContractSnapshot; readonly hashes: Readonly<Record<string, string>> };
const metadata = (harnessDir: string, readText: (path: string) => string): Metadata => {
  const [schemaPath, stagesPath, scopesPath] = metadataPaths(harnessDir);
  const schema = readText(schemaPath);
  const stagesText = readText(stagesPath);
  const scopesText = readText(scopesPath);
  const stateVersion = schema.match(/export\s+const\s+CURRENT_STATE_VERSION\s*=\s*["']([^"']+)["']/)?.[1];
  if (!stateVersion) return unproved(`${schemaPath} does not declare its workflow schema`);
  const stages: unknown = JSON.parse(stagesText);
  const scopes: unknown = JSON.parse(scopesText);
  if (!Array.isArray(stages) || stages.length === 0 || !scopes || typeof scopes !== "object" || Array.isArray(scopes) || Object.keys(scopes).length === 0) return unproved("the resulting stage or scope metadata is invalid");
  const stageMap: Record<string, Record<string, unknown>> = Object.create(null);
  for (const stage of stages) {
    if (!stage || typeof stage !== "object" || typeof stage.slug !== "string" || !stage.slug || Object.hasOwn(stageMap, stage.slug)) return unproved("the stage metadata has missing or duplicate identities");
    stageMap[stage.slug] = stage;
  }
  return {
    contract: { stateVersion, stages: stageMap, scopes: scopes as Record<string, unknown> },
    hashes: { [schemaPath]: hash(schema), [stagesPath]: hash(stagesText), [scopesPath]: hash(scopesText) },
  };
};

const resultingMetadata = (args: { readonly projectDir: string; readonly harnessDir: string; readonly plan: TransactionPlan; readonly candidateRoot?: string }): Metadata => metadata(args.harnessDir, (path) => {
  const view = resultingFile({ path, operations: args.plan.operations, caseInsensitive: process.platform === "win32" });
  if (view.kind === "retained") return read(args.projectDir, path) as string;
  if (view.kind === "unproved") return unproved(`${path} has ambiguous replacement operations`);
  const { operation, suffix } = view;
  if (operation.kind === "remove" || operation.kind === "symlink") return unproved(`${path} is removed or redirected by the plan`);
  if (args.candidateRoot !== undefined) return read(args.candidateRoot, path) as string;
  if (operation.kind === "write") return Buffer.from(operation.data, "base64").toString("utf8");
  const source = operation.kind === "tree" ? join(operation.source, suffix) : operation.source;
  return read(dirname(source), basename(source)) as string;
});

export type WorkflowRefreshInputs = { readonly workspace: ReturnType<typeof snapshotWorkspaceInputs>; readonly installed: Metadata };
export const captureWorkflowRefreshInputs = (projectDir: string, harnessDir: string): WorkflowRefreshInputs => ({
  workspace: snapshotWorkspaceInputs(projectDir),
  installed: metadata(harnessDir, (path) => read(projectDir, path) as string),
});

export type PlannedWorkflowRefresh = {
  readonly evidence: {
    readonly policy: string;
    readonly installed: Readonly<Record<string, string>>;
    readonly candidate: Readonly<Record<string, string>>;
    readonly workspaceInputs: Readonly<Record<string, string | null>>;
    readonly openWorkflows: readonly OpenWorkflowStage[];
    readonly stageRevalidation: Readonly<Record<string, readonly string[]>>;
  };
  readonly notes: readonly string[];
  readonly checks: Required<Pick<TransactionOptions, "validateLocked" | "validateCandidates" | "validateCommitted">>;
};

export const planWorkflowRefresh = (args: { readonly projectDir: string; readonly harnessDir: string; readonly plan: TransactionPlan; readonly policy: WorkflowRefreshPolicy; readonly inputs?: WorkflowRefreshInputs }): PlannedWorkflowRefresh => {
  if (!sameRoot(args.projectDir, args.plan.root)) return unproved("the transaction targets a different project");
  if (refreshOperationsOverlap({ operations: args.plan.operations, caseInsensitive: process.platform === "win32" })) return unproved("transaction paths overlap or alias each other");
  validateTransactionPlan(args.plan);
  const harnessDir = refreshPath(args.harnessDir, false);
  if (harnessDir.includes("/")) return unproved("the harness directory is not a project child");
  if (mutatesWorkflowWorkspace({ operations: args.plan.operations, caseInsensitive: process.platform === "win32" })) return unproved("the transaction would change workflow records or authored memory");
  const currentInputs = captureWorkflowRefreshInputs(args.projectDir, harnessDir);
  if (args.inputs && !sameContractValue(args.inputs, currentInputs)) return unproved("workflow or rule inputs changed while preparing the payload");
  const { workspace, installed } = args.inputs ?? currentInputs;
  const candidate = resultingMetadata({ ...args, harnessDir });
  const assessed = assessWorkflowRefresh({ installed: installed.contract, candidate: candidate.contract, openWorkflows: workspace.open, compareStages: args.policy.compareStages });
  if (assessed.kind !== "compatible") return unproved(`${assessed.contract}${assessed.name ? ` ${JSON.stringify(assessed.name)}` : ""} changes outside the selected policy`);
  const assertWorkspaceFresh = (): void => {
    if (!sameContractValue(snapshotWorkspaceInputs(args.projectDir), workspace)) unproved("workflow or authored-rule inputs changed after planning");
  };
  const validateLocked = (): void => {
    assertWorkspaceFresh();
    if (!sameContractValue(metadata(harnessDir, (path) => read(args.projectDir, path) as string).hashes, installed.hashes)) unproved("installed metadata changed after planning");
    if (!sameContractValue(resultingMetadata({ ...args, harnessDir }).hashes, candidate.hashes)) unproved("the planned payload changed after planning");
  };
  return {
    evidence: { policy: args.policy.id, installed: installed.hashes, candidate: candidate.hashes, workspaceInputs: workspace.hashes, openWorkflows: workspace.open, stageRevalidation: assessed.stageRevalidation },
    notes: args.policy.notes({ stageRevalidation: assessed.stageRevalidation, openWorkflows: workspace.open }),
    checks: {
      validateLocked,
      validateCandidates: (candidateRoot) => {
        validateLocked();
        if (!sameContractValue(resultingMetadata({ ...args, harnessDir, candidateRoot }).hashes, candidate.hashes)) unproved("staged metadata differs from the approved resulting payload");
      },
      validateCommitted: () => {
        assertWorkspaceFresh();
        if (!sameContractValue(metadata(harnessDir, (path) => read(args.projectDir, path) as string).hashes, candidate.hashes)) unproved("installed metadata differs from the approved resulting payload");
      },
    },
  };
};

export const combineRefreshChecks = (left: TransactionOptions, right: TransactionOptions): TransactionOptions => ({
  validateLocked: () => { left.validateLocked?.(); right.validateLocked?.(); },
  validateCandidates: (root) => { left.validateCandidates?.(root); right.validateCandidates?.(root); },
  validateCommitted: () => { left.validateCommitted?.(); right.validateCommitted?.(); },
});

// Full config normally writes its baseline even for unchanged payloads. An
// explicit empty plan still validates freshness under config's audit lock.
export const validateEmptyRefreshPlan = (plan: TransactionPlan, checks: TransactionOptions): void => {
  if (plan.operations.length > 0) throw new Error("empty refresh validation requires an empty plan");
  validateTransactionPlan(plan);
  checks.validateLocked?.();
  checks.validateCandidates?.(plan.root);
  checks.validateCommitted?.();
};
