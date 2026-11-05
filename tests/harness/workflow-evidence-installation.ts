import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { workflowStageToGraph } from "../../core/tools/aidlc-workflow-wire.ts";
import { REPO_ROOT } from "./fixtures.ts";
import { type InstallFixture, createInstallFixture, fileHash, runConfig, writeFixtureFile } from "./install-adoption.ts";
import { NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "./test-budget.ts";

export const EVIDENCE_RECORD = "aidlc/spaces/default/intents/fixture-8000000000000001";
export const EVIDENCE_MODULES = [
  "adapters/runtime-presence.ts", "answers/answer-availability.ts", "answers/reply-reuse.ts",
  "presence/gate-presence.ts", "presence/presence-evidence.ts",
];
export type EvidenceInstallation = {
  fixture: InstallFixture;
  environment: NodeJS.ProcessEnv;
  initialState: string;
};
export type Execution = { status: number | null; stdout: string; stderr: string };

export function evidenceSourceSnapshot(): string[] {
  const files = [...EVIDENCE_MODULES.map((name) => `core/workflow-evidence/${name}`),
    "core/tools/aidlc-lib.ts", "core/tools/aidlc-state.ts", "core/tools/aidlc-log.ts"];
  return files.map((name) => `${name}:${fileHash(join(REPO_ROOT, name))}`);
}

export function configureEvidenceInstallation(request: {
  fixture: InstallFixture; authority: "human" | "autonomous"; ordinaryAnswer?: boolean; requiresReview?: boolean;
}): EvidenceInstallation {
  const { fixture } = request;
  const installed = runConfig({ fixture, runner: fixture.packagedRunner, options: ["--yes"] });
  if (installed.status !== 0) throw new Error(`Isolated installation failed: ${installed.stdout}\n${installed.stderr}`);
  const environment: NodeJS.ProcessEnv = { ...fixture.env };
  environment.AIDLC_PROJECT_DIR = fixture.project;
  environment.AIDLC_STAGE_GRAPH = join(fixture.project, "stage-graph.json");
  environment.AIDLC_SCOPE_MAPPING = join(fixture.project, "scope-mapping.json");
  for (const key of ["AIDLC_UNATTENDED", "AIDLC_SESSION_OVERRIDE", "AIDLC_SESSION_OVERRIDE_SOURCE",
    "CLAUDE_CODE_SESSION_ID", "CLAUDE_PROJECT_DIR", "AIDLC_RUNTIME_ROOT", "AIDLC_RUNTIME_HARNESS_ROOT",
    "AIDLC_DEV_SOURCE", "AIDLC_COMPILED_EXECUTABLE"]) delete environment[key];
  const baseline = readFileSync(join(REPO_ROOT, "tests/fixtures/state-mid-ideation.md"), "utf8");
  const initialState = request.ordinaryAnswer ? baseline : baseline.replace("- [-] feasibility", "- [?] feasibility");
  // A synthetic engine question activates tracking without claiming any human message arrived.
  const event = request.ordinaryAnswer ? "DECISION_RECORDED" : "STAGE_AWAITING_APPROVAL";
  const rows = `**Event**: ${event}\n**Timestamp**: 2026-11-05T00:00:00Z\n**Stage**: feasibility\n**Fixture**: Synthetic nonhuman state only\n\n---\n`;
  const stage = workflowStageToGraph({ slug: "feasibility", name: "Feasibility", number: "1.3", phase: "ideation",
    execution: "ALWAYS", condition: "", leadAgent: "aidlc-architect-agent", supportAgents: [],
    mode: "inline", produces: ["feasibility-report"], consumes: [], requiresStage: [],
    approvalMode: request.authority, summaryConfirmation: "if-present", scopes: ["feature"],
    inputs: "", outputs: "feasibility-report.md", rulesInContext: [], sensorsApplicable: [],
    ...(request.requiresReview ? { reviewer: "aidlc-quality-agent", reviewArtifact: "feasibility-review",
      reviewerMaxIterations: 2, reviewClass: "adversarial" as const } : {}) });
  const files = [
    { path: "aidlc/active-space", text: "default" },
    { path: "aidlc/.aidlc-clone-id", text: "evidenceprobe\nfixture\n" },
    { path: "aidlc/spaces/default/intents/active-intent", text: "fixture-8000000000000001" },
    { path: `${EVIDENCE_RECORD}/aidlc-state.md`, text: initialState },
    { path: `${EVIDENCE_RECORD}/audit/fixture-evidenceprobe.md`, text: rows },
    { path: "stage-graph.json", text: JSON.stringify([stage]) },
    { path: "scope-mapping.json", text: JSON.stringify({ feature: { stages: { feasibility: "EXECUTE" },
      description: "synthetic installed evidence proof", depth: "Standard" } }) },
  ];
  files.forEach((file) => { writeFixtureFile({ root: fixture.project, ...file }); });
  return { fixture, environment, initialState };
}

export { createInstallFixture };

export function runEvidenceCommand(request: { installation: EvidenceInstallation; args: string[] }): Execution {
  const { fixture, environment } = request.installation;
  const result = spawnSync(process.execPath, [fixture.installedRunner, "engine", ...request.args,
    "--project-dir", fixture.project], { cwd: fixture.project, env: environment, encoding: "utf8",
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS) });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function installedObservation(installation: EvidenceInstallation): unknown {
  const { fixture, environment } = installation;
  const module = pathToFileURL(join(fixture.project, ".claude/tools/aidlc-lib.ts")).href;
  const script = `const lib = await import(${JSON.stringify(module)}); console.log(JSON.stringify(lib.inspectHumanTurn(${JSON.stringify(fixture.project)})));`;
  const result = spawnSync(process.execPath, ["--eval", script], { cwd: fixture.project,
    env: environment, encoding: "utf8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Installed collector failed: ${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

export function installedState(installation: EvidenceInstallation): string {
  return readFileSync(join(installation.fixture.project, EVIDENCE_RECORD, "aidlc-state.md"), "utf8");
}

export function installedAudit(installation: EvidenceInstallation): string {
  const root = join(installation.fixture.project, "aidlc");
  const files = readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) =>
    entry.isFile() && entry.name.endsWith(".md") && relative(root, entry.parentPath).split(/[\\/]/).includes("audit"));
  return files.map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8")).join("\n");
}

export function installedDependenciesExist(installation: EvidenceInstallation): boolean {
  return EVIDENCE_MODULES.every((name) => existsSync(join(installation.fixture.project, ".claude/workflow-evidence", name)));
}

export function installedGateInterpretations(installation: EvidenceInstallation): unknown {
  const { fixture, environment } = installation;
  const collector = pathToFileURL(join(fixture.project, ".claude/tools/aidlc-lib.ts")).href;
  const interpreter = pathToFileURL(join(fixture.project, ".claude/workflow-evidence/presence/gate-presence.ts")).href;
  const script = `const lib = await import(${JSON.stringify(collector)}); const policy = await import(${JSON.stringify(interpreter)});
    const observation = lib.inspectHumanTurn(${JSON.stringify(fixture.project)}); const before = JSON.stringify(observation);
    const human = policy.interpretGatePresence({ evidence: observation.evidence, requirement: { kind: "human-required" } });
    const autonomous = policy.interpretGatePresence({ evidence: observation.evidence, requirement: { kind: "autonomous", authority: "stage-definition" } });
    console.log(JSON.stringify({ observation, human, autonomous, unchanged: before === JSON.stringify(observation),
      identityPreserved: human.evidence === observation.evidence && autonomous.evidence === observation.evidence }));`;
  const result = spawnSync(process.execPath, ["--eval", script], { cwd: fixture.project,
    env: environment, encoding: "utf8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Installed policy probe failed: ${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}
