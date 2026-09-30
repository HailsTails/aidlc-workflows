import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { env, stdin } from "node:process";
import { fileURLToPath } from "node:url";
import { appendGateRun } from "../tools/rin-harness-gate-runs.ts";

type HookInput = {
  readonly tool_name?: string;
  readonly tool_input?: { readonly command?: string };
  readonly cwd?: string;
};

// Every shell-bearing tool this harness offers, as a closed set. This gate owns
// the red-audit hard block half of the two-hook autonomy guarantee, so a tool
// absent here is a silent total bypass rather than a narrower check. Adding a
// shell tool to the harness means adding it here AND to this hook's
// settings.json matcher.
const SHELL_TOOL_NAMES: readonly string[] = ["Bash", "PowerShell"];

const isShellToolName = (toolName: string | undefined): boolean =>
  toolName !== undefined && SHELL_TOOL_NAMES.includes(toolName);

type AuditJson = {
  readonly pass: boolean;
  readonly violations_count: number;
  readonly violations: readonly {
    readonly rule: string;
    readonly file: string;
    readonly line: number;
    readonly snippet: string;
  }[];
};

type AuditOutcome =
  | { readonly kind: "spoke"; readonly audit: AuditJson }
  | {
      readonly kind: "unavailable";
      readonly scriptName: string;
      readonly reason: string;
    };

const REPORT_COMPLETION = /aidlc-orchestrate\.ts\s+report\b/;
const COMPLETION_RESULT = /--result\s+(approved|completed)\b/;
const BYPASS_TOKEN = "AIDLC_CONSTITUTION_BYPASS=1";
const MAX_FINDINGS_SHOWN = 8;
// A fresh worktree's FIRST spawn pays bun's cold-start cost (transpile-cache warm,
// native-binding resolution) on top of the audit's own runtime. The first attempt
// gets a generous window; if it times out (an ENVIRONMENTAL cost, not a verdict) it
// is retried ONCE with a larger window now that bun is warm. Only a second failure
// denies — fail-closed is preserved (a tool that genuinely cannot run still blocks),
// but a cold-start latency spike no longer false-denies every fresh-worktree gate.
const VERDICT_TOOL_COLD_TIMEOUT_DEFAULT_MS = 60_000;
const VERDICT_TOOL_WARM_TIMEOUT_DEFAULT_MS = 120_000;
const timeoutFromEnv = ({
  overrideValue,
  fallbackMs,
}: {
  readonly overrideValue: string | undefined;
  readonly fallbackMs: number;
}): number => {
  const override = Number(overrideValue ?? "");
  return Number.isFinite(override) && override > 0 ? override : fallbackMs;
};
type SpawnWindows = { readonly coldMs: number; readonly warmMs: number };
const resolveSpawnWindows = ({
  coldOverride,
  warmOverride,
}: {
  readonly coldOverride: string | undefined;
  readonly warmOverride: string | undefined;
}): SpawnWindows => {
  const coldMs = timeoutFromEnv({
    overrideValue: coldOverride,
    fallbackMs: VERDICT_TOOL_COLD_TIMEOUT_DEFAULT_MS,
  });
  const requestedWarmMs = timeoutFromEnv({
    overrideValue: warmOverride ?? coldOverride,
    fallbackMs: VERDICT_TOOL_WARM_TIMEOUT_DEFAULT_MS,
  });
  return { coldMs, warmMs: Math.max(requestedWarmMs, coldMs) };
};

// The elapsed time is MEASURED, not inferred from the budget. A refusal naming
// only the budget cannot distinguish a 61-second overrun from a 600-second one,
// so an operator reading it cannot tell a marginal spawn window from a genuinely
// broken audit — and the only remedy such a refusal implies is the bypass, which
// lanes were correctly refusing while having nothing else to act on.
type AuditSpawnOutcome =
  | { readonly kind: "timed-out" }
  | { readonly kind: "failed-to-start"; readonly message: string }
  | {
      readonly kind: "exited";
      readonly status: number | null;
      readonly stdout: string;
    };

type TimedSpawn = {
  readonly spawned: AuditSpawnOutcome;
  readonly elapsedMs: number;
};

type AuditSpawnRequest = {
  readonly scriptPath: string;
  readonly auditRoot: string;
  readonly timeoutMs: number;
};

type GateClock = { readonly nowMillis: () => number };

type VerdictToolPorts = {
  readonly spawnAudit: (request: AuditSpawnRequest) => AuditSpawnOutcome;
  readonly clock: GateClock;
};

const isTimeout = (error: Error): boolean =>
  "code" in error
    ? error.code === "ETIMEDOUT"
    : error.message.includes("ETIMEDOUT");

const auditSpawnOutcomeOf = ({
  spawned,
}: {
  readonly spawned: SpawnSyncReturns<Buffer>;
}): AuditSpawnOutcome => {
  if (spawned.error !== undefined) {
    return isTimeout(spawned.error)
      ? { kind: "timed-out" }
      : { kind: "failed-to-start", message: spawned.error.message };
  }
  return {
    kind: "exited",
    status: spawned.status,
    stdout: spawned.stdout?.toString() ?? "",
  };
};

const verdictToolPorts = (): VerdictToolPorts => ({
  spawnAudit: ({ scriptPath, auditRoot, timeoutMs }) =>
    auditSpawnOutcomeOf({
      spawned: spawnSync(
        "bun",
        [scriptPath, "--project-dir", auditRoot, "--json"],
        {
          cwd: auditRoot,
          timeout: timeoutMs,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    }),
  clock: { nowMillis: () => Date.now() },
});

const timedAuditSpawn = ({
  request,
  ports,
}: {
  readonly request: AuditSpawnRequest;
  readonly ports: VerdictToolPorts;
}): TimedSpawn => {
  const startedAt = ports.clock.nowMillis();
  const spawned = ports.spawnAudit(request);
  return { spawned, elapsedMs: ports.clock.nowMillis() - startedAt };
};

// Both attempts are named when a retry happened, because they answer different
// questions: the cold figure shows what the first spawn cost including bun's
// start-up, the warm one shows the audit's own runtime with that removed. A
// single combined number hides which of the two is the problem.
const describeElapsed = ({
  coldMs,
  warmMs,
}: {
  readonly coldMs: number;
  readonly warmMs: number | null;
}): string =>
  warmMs === null ? `${coldMs}ms` : `${coldMs}ms cold then ${warmMs}ms warm`;

const isGitCheckout = ({ root }: { readonly root: string }): boolean =>
  existsSync(join(root, ".git"));

const nearestCheckoutAt = (candidate: string): string | undefined => {
  if (isGitCheckout({ root: candidate })) return candidate;
  const parent = dirname(candidate);
  return parent === candidate ? undefined : nearestCheckoutAt(parent);
};

const hookDir = dirname(fileURLToPath(import.meta.url));
const checkoutRootFromCommandCwd = (
  cwd: string | undefined,
): string | undefined => {
  if (cwd === undefined || cwd === "") return undefined;
  return nearestCheckoutAt(resolve(cwd));
};
const hookFileCheckout = (): string => {
  const fromHookFile = resolve(join(hookDir, "..", ".."));
  return isGitCheckout({ root: fromHookFile })
    ? fromHookFile
    : resolve(env.CLAUDE_PROJECT_DIR ?? fromHookFile);
};
const resolveAuditRoot = ({
  commandCwd,
}: {
  readonly commandCwd: string | undefined;
}): string => {
  const explicitOverride = env.RIN_CONSTITUTION_GATE_TOOL_ROOT;
  if (explicitOverride !== undefined && explicitOverride !== "") {
    return resolve(explicitOverride);
  }
  return checkoutRootFromCommandCwd(commandCwd) ?? hookFileCheckout();
};

const readStdin = (): Promise<string> =>
  new Promise((resolvePromise) => {
    let raw = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      raw += chunk;
    });
    stdin.on("end", () => resolvePromise(raw));
  });

const deny = (message: string): never => {
  process.stderr.write(message);
  process.exit(2);
};

const spawnWithColdStartRetry = ({
  scriptName,
  scriptPath,
  auditRoot,
  windows,
  ports,
}: {
  readonly scriptName: string;
  readonly scriptPath: string;
  readonly auditRoot: string;
  readonly windows: SpawnWindows;
  readonly ports: VerdictToolPorts;
}): AuditOutcome => {
  const spawnAudit = (timeoutMs: number): TimedSpawn =>
    timedAuditSpawn({ request: { scriptPath, auditRoot, timeoutMs }, ports });

  const firstAttempt = spawnAudit(windows.coldMs);
  // A timeout is bun's cold start, not a failed audit — retry once now bun is warm,
  // with more headroom. Any other error, or a second timeout, falls through to deny.
  const retried = firstAttempt.spawned.kind === "timed-out";
  const attempt = retried ? spawnAudit(windows.warmMs) : firstAttempt;
  const result = attempt.spawned;

  switch (result.kind) {
    case "timed-out":
      return {
        kind: "unavailable",
        scriptName,
        reason: `timed out ${retried ? "twice" : "once"} — ran ${describeElapsed(
          {
            coldMs: firstAttempt.elapsedMs,
            warmMs: retried ? attempt.elapsedMs : null,
          },
        )} against a ${windows.coldMs}ms cold / ${windows.warmMs}ms warm budget, and produced no verdict. This is the AUDIT'S RUNTIME, not its result — it says nothing about whether the tree is clean. Raise the window for this run with RIN_CONSTITUTION_GATE_WARM_TIMEOUT_MS, or run \`pnpm run audit:harness\` yourself and read the verdict directly`,
      };
    case "failed-to-start":
      return {
        kind: "unavailable",
        scriptName,
        reason: `failed to run: ${result.message} (after ${attempt.elapsedMs}ms)`,
      };
    case "exited":
      try {
        return {
          kind: "spoke",
          audit: JSON.parse(result.stdout.trim()) as AuditJson,
        };
      } catch {
        return {
          kind: "unavailable",
          scriptName,
          reason: `emitted no parseable JSON verdict (exit ${result.status ?? "unknown"}, after ${attempt.elapsedMs}ms)`,
        };
      }
  }
};

const runVerdictTool = ({
  scriptName,
  auditRoot,
  windows,
  ports,
}: {
  readonly scriptName: string;
  readonly auditRoot: string;
  readonly windows: SpawnWindows;
  readonly ports: VerdictToolPorts;
}): AuditOutcome => {
  const scriptPath = join(auditRoot, ".claude", "tools", scriptName);
  if (!existsSync(scriptPath)) {
    return {
      kind: "unavailable",
      scriptName,
      reason: `not found at ${scriptPath}`,
    };
  }
  return spawnWithColdStartRetry({
    scriptName,
    scriptPath,
    auditRoot,
    windows,
    ports,
  });
};

const unavailableReasons = ({
  outcomes,
}: {
  readonly outcomes: readonly AuditOutcome[];
}): readonly string[] =>
  outcomes.flatMap((outcome) =>
    outcome.kind === "unavailable"
      ? [`  ${outcome.scriptName} — ${outcome.reason}`]
      : [],
  );

type GatedInvocation = {
  readonly command: string;
  readonly commandCwd: string | undefined;
};

const gatedInvocationFrom = ({
  raw,
}: {
  readonly raw: string;
}): GatedInvocation | null => {
  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    return null;
  }
  if (!isShellToolName(input.tool_name)) return null;
  const command = input.tool_input?.command ?? "";
  if (!(REPORT_COMPLETION.test(command) && COMPLETION_RESULT.test(command))) {
    return null;
  }
  if (command.includes(BYPASS_TOKEN)) return null;
  return { command, commandCwd: input.cwd };
};

const denyOnFindings = ({
  audit,
  headline,
  formatFinding,
  remedy,
}: {
  readonly audit: AuditJson;
  readonly headline: string;
  readonly formatFinding: (
    violation: AuditJson["violations"][number],
  ) => string;
  readonly remedy: string;
}): void => {
  const shown = audit.violations.slice(0, MAX_FINDINGS_SHOWN);
  const overflow =
    audit.violations_count > MAX_FINDINGS_SHOWN
      ? `  … and ${audit.violations_count - MAX_FINDINGS_SHOWN} more.\n`
      : "";
  deny(
    `${headline}${shown.map(formatFinding).join("\n")}\n${overflow}${remedy}`,
  );
};

const recordGateRun = ({
  command,
  audit,
  decay,
  auditRoot,
  clock,
}: {
  readonly command: string;
  readonly audit: AuditJson | null;
  readonly decay: AuditJson | null;
  readonly auditRoot: string;
  readonly clock: GateClock;
}): void => {
  try {
    appendGateRun({
      projectDir: auditRoot,
      stage: command.match(/--stage\s+([A-Za-z0-9._-]+)/)?.[1] ?? "ungrouped",
      result:
        command.match(/--result\s+(approved|completed)/)?.[1] ?? "unknown",
      command,
      verdict: {
        pass: audit?.pass ?? false,
        violationsCount: audit?.violations_count ?? 0,
        decayPass: decay?.pass ?? false,
        decayViolationsCount: decay?.violations_count ?? 0,
      },
      timestamp: new Date(clock.nowMillis()).toISOString(),
    });
  } catch {
    // Best-effort provenance — a ledger-write failure must never break the gate.
  }
};

const gatherVerdicts = ({
  auditRoot,
  windows,
  ports,
}: {
  readonly auditRoot: string;
  readonly windows: SpawnWindows;
  readonly ports: VerdictToolPorts;
}): {
  readonly audit: AuditJson | null;
  readonly decay: AuditJson | null;
} => {
  const auditOutcome = runVerdictTool({
    scriptName: "rin-harness-constitution-audit.ts",
    auditRoot,
    windows,
    ports,
  });
  const decayOutcome = runVerdictTool({
    scriptName: "rin-harness-carve-out-decay.ts",
    auditRoot,
    windows,
    ports,
  });

  const unavailable = unavailableReasons({
    outcomes: [auditOutcome, decayOutcome],
  });
  if (unavailable.length > 0) {
    deny(
      `Blocked: stage completion refused — the constitution gate could not reach its ` +
        `verdict tool(s), so this stage is UNVERIFIED, not passing:\n` +
        unavailable.join("\n") +
        `\nThis gate is a hard stop: a missing or broken verdict tool denies. Restore the ` +
        `tool (a fresh clone may need its plugin composed first), or bypass deliberately ` +
        `with ${BYPASS_TOKEN} if you are certain the gate is not applicable.\n`,
    );
  }

  return {
    audit: auditOutcome.kind === "spoke" ? auditOutcome.audit : null,
    decay: decayOutcome.kind === "spoke" ? decayOutcome.audit : null,
  };
};

const main = async (): Promise<void> => {
  if (stdin.isTTY) process.exit(0);
  const raw = await readStdin();
  if (raw.trim() === "") process.exit(0);

  const invocation = gatedInvocationFrom({ raw });
  if (invocation === null) process.exit(0);
  const { command, commandCwd } = invocation;

  const auditRoot = resolveAuditRoot({ commandCwd });

  const ports = verdictToolPorts();
  const windows = resolveSpawnWindows({
    coldOverride: env.RIN_CONSTITUTION_GATE_TIMEOUT_MS,
    warmOverride: env.RIN_CONSTITUTION_GATE_WARM_TIMEOUT_MS,
  });

  const { audit, decay } = gatherVerdicts({ auditRoot, windows, ports });

  recordGateRun({ command, audit, decay, auditRoot, clock: ports.clock });

  if (audit && !audit.pass) {
    denyOnFindings({
      audit,
      headline:
        `Blocked: stage completion refused — ${audit.violations_count} constitution ` +
        `violation(s) must be resolved before this stage can advance.\n`,
      formatFinding: (violation) =>
        `  [${violation.rule}] ${violation.file}:${violation.line} — ${violation.snippet}`,
      remedy:
        `Fix the violations, or record a deliberate carve-out in the owning CD's ` +
        `sidecar under .constitution-carve-outs/cd-<n>.json. This gate is a hard ` +
        `stop (AIDLC's sensors are advisory; the constitution audit is not).\n`,
    });
  }

  if (decay && !decay.pass) {
    denyOnFindings({
      audit: decay,
      headline:
        `Blocked: stage completion refused — CD-46 carve-out decay: ${decay.violations_count} ` +
        `carved file(s) were touched under an active carve-out.\n`,
      formatFinding: (finding) =>
        `  [${finding.rule}] ${finding.file} — ${finding.snippet}`,
      remedy:
        `Touching a carved file forfeits its carve-out: pay down the violations and delete ` +
        `the entry from the owning CD's sidecar under .constitution-carve-outs/cd-<n>.json. ` +
        `CD-46 cannot itself be carved out.\n`,
    });
  }

  process.exit(0);
};

if (import.meta.main) {
  main().catch(() => process.exit(0));
}

export {
  type AuditOutcome,
  type AuditSpawnOutcome,
  resolveSpawnWindows,
  type SpawnWindows,
  spawnWithColdStartRetry,
  type VerdictToolPorts,
};
