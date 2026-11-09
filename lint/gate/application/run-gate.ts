import type { LanePlan } from "../domain/lane-plan.ts";
import type { WaitReason } from "../domain/machine-lock.ts";
import {
  verdictOf,
  type CheckId,
  type CheckOutcome,
  type GateVerdict,
} from "../domain/outcome.ts";
import { runChecks, type GateCheck } from "./gate-check.ts";
import type {
  FullRequest,
  GateRequest,
  LockedRequest,
  ScopeRequest,
  UpdateGoldensRequest,
} from "./gate-request.ts";
import { fullScopeOf, scopeOf, type GateScope, type ScopeSources } from "./gate-scope.ts";
import { updateGoldens, type GoldensDependencies } from "./goldens-check.ts";
import type {
  CommandRunner,
  LanePlanSource,
  Loaded,
  MachineLock,
  Progress,
  Repository,
  Toolchain,
  Workspace,
} from "./ports.ts";

export type RunnableRequest = Exclude<GateRequest, { readonly kind: "help" }>;

export type GateProblem = { readonly problem: string; readonly fix: string };

export type GateReport = {
  readonly mode: RunnableRequest["kind"];
  readonly lane: string | undefined;
  readonly base: string | undefined;
  readonly verdict: GateVerdict;
  readonly outcomes: readonly CheckOutcome[];
  readonly problem: GateProblem | undefined;
  readonly exitCode: number | undefined;
};

export type GateServices = {
  readonly plans: LanePlanSource;
  readonly repository: Repository;
  readonly workspace: Workspace;
  readonly lock: MachineLock;
  readonly progress: Progress;
  readonly runner: CommandRunner;
  readonly goldens: GoldensDependencies;
  readonly checksFor: (plan: LanePlan) => readonly GateCheck[];
  readonly toolchain: Toolchain;
};

const LOADS_ESLINT_CONFIG: readonly CheckId[] = ["lint", "disciplines", "tests"];

const toolchainFor = (services: GateServices, checks: readonly GateCheck[]): Loaded<string> =>
  checks.some((check) => LOADS_ESLINT_CONFIG.includes(check.id))
    ? services.toolchain.ready()
    : { ok: true, value: "no check loads the ESLint config" };

const report = (request: RunnableRequest, partial: Partial<GateReport>): GateReport => ({
  mode: request.kind,
  lane: undefined,
  base: undefined,
  verdict: "error",
  outcomes: [],
  problem: undefined,
  exitCode: undefined,
  ...partial,
});

const failed = (request: RunnableRequest, { problem, fix }: GateProblem): GateReport =>
  report(request, { verdict: "error", problem: { problem, fix } });

const busy = (reason: WaitReason): GateProblem => ({
  problem: `no machine lock slot: ${reason}`,
  fix:
    "Wait for one (raise --wait), and meanwhile run light work, which never takes a slot: " +
    "bun scripts/gate.ts --scope <lane-id>, typecheck, bun test.",
});

const locked = async (
  services: GateServices,
  request: FullRequest | UpdateGoldensRequest | LockedRequest,
  action: () => Promise<GateReport>,
): Promise<GateReport> => {
  const lane = request.kind === "full" ? request.laneId : undefined;
  const command = `gate ${request.kind}`;
  const outcome = await services.lock.acquire({ lane, command, waitMs: request.waitMs });
  if (!outcome.acquired) {
    return report(request, { verdict: "busy", problem: busy(outcome.reason) });
  }
  try {
    return await action();
  } finally {
    services.lock.release();
  }
};

type CheckedRun = {
  readonly request: ScopeRequest | FullRequest;
  readonly plan: LanePlan;
  readonly scope: Loaded<GateScope>;
};

const checked = async (services: GateServices, run: CheckedRun): Promise<GateReport> => {
  const { request, plan, scope } = run;
  if (!scope.ok) {
    return failed(request, scope);
  }
  const { only } = request;
  const checks = services
    .checksFor(plan)
    .filter((check) => only === "all" || only.includes(check.id));
  const toolchain = toolchainFor(services, checks);
  if (!toolchain.ok) {
    return failed(request, toolchain);
  }
  const outcomes = await runChecks({ scope: scope.value, checks, progress: services.progress });
  const lane = scope.value.lane?.id;
  const base = scope.value.base?.ref;
  return report(request, { lane, base, verdict: verdictOf(outcomes), outcomes });
};

const sourcesFor = (services: GateServices, plan: LanePlan): ScopeSources => ({
  plan,
  repository: services.repository,
  workspace: services.workspace,
});

const runScope = async (services: GateServices, request: ScopeRequest): Promise<GateReport> => {
  const plan = services.plans.load();
  if (!plan.ok) {
    return failed(request, plan);
  }
  const scope = scopeOf(sourcesFor(services, plan.value), request);
  return checked(services, { request, plan: plan.value, scope });
};

const runFull = (services: GateServices, request: FullRequest): Promise<GateReport> =>
  locked(services, request, async () => {
    const plan = services.plans.load();
    if (!plan.ok) {
      return failed(request, plan);
    }
    const scope = fullScopeOf(sourcesFor(services, plan.value), request);
    return checked(services, { request, plan: plan.value, scope });
  });

const runUpdateGoldens = (
  services: GateServices,
  request: UpdateGoldensRequest,
): Promise<GateReport> =>
  locked(services, request, async () => {
    const failure = updateGoldens(services.goldens, request.build);
    return failure === undefined
      ? report(request, { verdict: "green" })
      : failed(request, { problem: `${failure.subject} ${failure.violation}`, fix: failure.fix });
  });

const runLocked = (services: GateServices, request: LockedRequest): Promise<GateReport> =>
  locked(services, request, async () => {
    const [program = "", ...rest] = request.command;
    const exitCode = services.runner.attach({ label: program, argv: [program, ...rest] });
    return report(request, { verdict: exitCode === 0 ? "green" : "red", exitCode });
  });

export const runGateRequest = (
  services: GateServices,
  request: RunnableRequest,
): Promise<GateReport> => {
  switch (request.kind) {
    case "scope":
      return runScope(services, request);
    case "full":
      return runFull(services, request);
    case "update-goldens":
      return runUpdateGoldens(services, request);
    case "locked":
      return runLocked(services, request);
  }
};
