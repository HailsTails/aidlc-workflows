import type { DisciplinesCheckOutcome, DisciplinesCheckRequest } from "../tools/rin-disciplines-check.ts";
import type { CommandOutput } from "../tools/rin-gates/review-process-port.ts";
import { CHECK_COMMAND_TEXT, type FailingSection, failingSectionsOf, remedyOf } from "../tools/rin-disciplines-report.ts";
import type { ConstitutionEngine } from "../tools/rin-harness-config.ts";
import type { PathOperations } from "../tools/rin-harness-path-operations.ts";
import { CONSTITUTION_BYPASS_TOKEN, GATED_SHELL_TOOL_NAMES } from "./rin-constitution-gate-scope.ts";
import { isCompletionReport } from "./rin-gate-invocation.ts";

type GateDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly reason: string };

type GatedCompletion = {
  readonly command: string;
  readonly commandCwd: string | undefined;
};

type EngineReading =
  | { readonly kind: "read"; readonly constitutionEngine: ConstitutionEngine }
  | { readonly kind: "unavailable"; readonly reason: string };

type WalkerGateOutcome =
  | { readonly kind: "allowed" }
  | { readonly kind: "denied"; readonly reason: string }
  | { readonly kind: "unverified"; readonly reason: string };

type GateRunVerdict = {
  readonly pass: boolean;
  readonly violationsCount: number;
  readonly decayPass: boolean;
  readonly decayViolationsCount: number;
};

type ConstitutionGatePorts = {
  readonly checkoutRootOf: (request: { readonly commandCwd: string | undefined }) => string | undefined;
  readonly readEngine: (request: { readonly checkoutRoot: string }) => EngineReading;
  readonly runWalkerGate: (request: { readonly checkoutRoot: string; readonly hookInput: string }) => WalkerGateOutcome;
  readonly runDisciplinesCheck: (request: DisciplinesCheckRequest) => DisciplinesCheckOutcome;
  readonly recordGateRun: (request: {
    readonly command: string;
    readonly checkoutRoot: string;
    readonly verdict: GateRunVerdict;
  }) => Promise<void>;
};

const MAX_LINES_SHOWN_PER_SECTION = 5;

const ALLOW: GateDecision = { kind: "allow" };

const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);

const parsedJsonOf = ({ text }: { readonly text: string }): unknown => {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return undefined;
  }
};

const stringFieldOf = ({
  container,
  key,
}: {
  readonly container: unknown;
  readonly key: string;
}): string | undefined => {
  if (!isRecord(container)) {
    return undefined;
  }
  const field = container[key];
  return typeof field === "string" ? field : undefined;
};

const gatedCompletionOf = ({ hookInput }: { readonly hookInput: string }): GatedCompletion | undefined => {
  const hookCall = parsedJsonOf({ text: hookInput });
  const toolName = stringFieldOf({ container: hookCall, key: "tool_name" });
  if (toolName === undefined || !GATED_SHELL_TOOL_NAMES.includes(toolName)) {
    return undefined;
  }
  const toolInput = isRecord(hookCall) ? hookCall["tool_input"] : undefined;
  const command = stringFieldOf({ container: toolInput, key: "command" }) ?? "";
  if (!isCompletionReport({ command }) || command.includes(CONSTITUTION_BYPASS_TOKEN)) {
    return undefined;
  }
  return { command, commandCwd: stringFieldOf({ container: hookCall, key: "cwd" }) };
};

const unverifiedDenialOf = ({ reason }: { readonly reason: string }): GateDecision => ({
  kind: "deny",
  reason: [
    "Blocked: stage completion refused. The constitution gate reached no verdict, so this stage is unverified, not passing:",
    `  ${reason}`,
    `Fix what is named above, or bypass deliberately with ${CONSTITUTION_BYPASS_TOKEN} if you are certain the gate does not apply.`,
    "",
  ].join("\n"),
});

const shownSectionLinesOf = ({ section }: { readonly section: FailingSection }): readonly string[] => {
  const shown = section.lines.slice(0, MAX_LINES_SHOWN_PER_SECTION).map((line) => `    ${line}`);
  const hiddenCount = section.lines.length - MAX_LINES_SHOWN_PER_SECTION;
  const overflow =
    hiddenCount > 0 ? [`    … and ${String(hiddenCount)} more; run \`${CHECK_COMMAND_TEXT}\` for the full report.`] : [];
  return [`  ${section.header}`, ...shown, ...overflow];
};

const failedDenialOf = ({ report }: { readonly report: string }): GateDecision => {
  const failingSections = failingSectionsOf({ report });
  return {
    kind: "deny",
    reason: [
      "Blocked: stage completion refused. discipline-core fails on this tree:",
      ...failingSections.flatMap((section) => shownSectionLinesOf({ section })),
      ...failingSections.map((section) => remedyOf({ section })),
      "",
    ].join("\n"),
  };
};

const failingLineCountOf = ({
  sections,
}: {
  readonly sections: readonly FailingSection[];
}): number => sections.reduce((count, section) => count + section.lines.length, 0);

const gateRunVerdictOf = ({ outcome }: { readonly outcome: DisciplinesCheckOutcome }): GateRunVerdict => {
  switch (outcome.kind) {
    case "passed":
      return { pass: true, violationsCount: 0, decayPass: true, decayViolationsCount: 0 };
    case "failed": {
      const sections = failingSectionsOf({ report: outcome.report });
      const forfeitedCount = failingLineCountOf({
        sections: sections.filter((section) => section.name === "forfeited"),
      });
      return {
        pass: false,
        violationsCount: failingLineCountOf({ sections }) - forfeitedCount,
        decayPass: forfeitedCount === 0,
        decayViolationsCount: forfeitedCount,
      };
    }
    case "unverified":
      return { pass: false, violationsCount: 0, decayPass: false, decayViolationsCount: 0 };
  }
};

const disciplinesDecisionOf = ({ outcome }: { readonly outcome: DisciplinesCheckOutcome }): GateDecision => {
  switch (outcome.kind) {
    case "passed":
      return ALLOW;
    case "failed":
      return failedDenialOf({ report: outcome.report });
    case "unverified":
      return unverifiedDenialOf({
        reason: `discipline-core: ${outcome.reason}. Run \`${CHECK_COMMAND_TEXT}\` in the checkout to see it yourself.`,
      });
  }
};

const walkerDecisionOf = ({ outcome }: { readonly outcome: WalkerGateOutcome }): GateDecision => {
  switch (outcome.kind) {
    case "allowed":
      return ALLOW;
    case "denied":
      return { kind: "deny", reason: outcome.reason };
    case "unverified":
      return unverifiedDenialOf({ reason: `rin-walker gate: ${outcome.reason}` });
  }
};

const engineDecisionOf = async ({
  hookInput,
  completion,
  checkoutRoot,
  constitutionEngine,
  ports,
}: {
  readonly hookInput: string;
  readonly completion: GatedCompletion;
  readonly checkoutRoot: string;
  readonly constitutionEngine: ConstitutionEngine;
  readonly ports: ConstitutionGatePorts;
}): Promise<GateDecision> => {
  switch (constitutionEngine.engine) {
    case "rin-walker":
      return walkerDecisionOf({ outcome: ports.runWalkerGate({ checkoutRoot, hookInput }) });
    case "discipline-core": {
      const outcome = ports.runDisciplinesCheck({
        checkoutRoot,
        baseRevision: constitutionEngine.baseRevision,
      });
      await ports.recordGateRun({ command: completion.command, checkoutRoot, verdict: gateRunVerdictOf({ outcome }) });
      return disciplinesDecisionOf({ outcome });
    }
  }
};

const constitutionGateDecisionOf = async ({
  hookInput,
  ports,
}: {
  readonly hookInput: string;
  readonly ports: ConstitutionGatePorts;
}): Promise<GateDecision> => {
  const completion = gatedCompletionOf({ hookInput });
  if (completion === undefined) {
    return ALLOW;
  }
  const checkoutRoot = ports.checkoutRootOf({ commandCwd: completion.commandCwd });
  if (checkoutRoot === undefined) {
    return unverifiedDenialOf({
      reason: `no git checkout contains the command's working directory (${completion.commandCwd ?? "none given"}), so there is no tree to check`,
    });
  }
  const reading = ports.readEngine({ checkoutRoot });
  switch (reading.kind) {
    case "unavailable":
      return unverifiedDenialOf({ reason: `constitution.engine could not be read: ${reading.reason}` });
    case "read":
      return engineDecisionOf({
        hookInput,
        completion,
        checkoutRoot,
        constitutionEngine: reading.constitutionEngine,
        ports,
      });
  }
};

const constitutionEngineFromWire = ({ text }: { readonly text: string }): ConstitutionEngine | undefined => {
  const wire = parsedJsonOf({ text });
  const engine = stringFieldOf({ container: wire, key: "engine" });
  switch (engine) {
    case "rin-walker":
      return { engine };
    case "discipline-core":
      return { engine, baseRevision: stringFieldOf({ container: wire, key: "baseRevision" }) };
    default:
      return undefined;
  }
};

const UNKNOWN_ENGINE_COMMAND = 'unknown command "constitution-engine"';

const WALKER_DENIAL_EXIT_CODE = 2;

const engineReadingOf = ({
  configToolPath,
  output,
}: {
  readonly configToolPath: string;
  readonly output: CommandOutput;
}): EngineReading => {
  const printed = `${output.stdout}${output.stderr}`.trim();
  if (printed.includes(UNKNOWN_ENGINE_COMMAND)) {
    return {
      kind: "unavailable",
      reason: `this checkout's rin install predates constitution.engine (${configToolPath} has no constitution-engine command); merge the base branch into this checkout, or re-sync rin here`,
    };
  }
  const constitutionEngine = output.status === 0 ? constitutionEngineFromWire({ text: output.stdout }) : undefined;
  if (constitutionEngine === undefined) {
    return { kind: "unavailable", reason: `${configToolPath} exited ${String(output.status)}: ${printed}` };
  }
  return { kind: "read", constitutionEngine };
};

const walkerGateOutcomeOf = ({
  walkerGatePath,
  output,
}: {
  readonly walkerGatePath: string;
  readonly output: CommandOutput;
}): WalkerGateOutcome => {
  if (output.status === 0) {
    return { kind: "allowed" };
  }
  if (output.status === WALKER_DENIAL_EXIT_CODE) {
    return { kind: "denied", reason: output.stderr };
  }
  return { kind: "unverified", reason: `${walkerGatePath} exited ${String(output.status)}: ${output.stderr.trim()}` };
};

const checkoutPluginPathOf = ({
  hookDirectory,
  checkoutRoot,
  pluginPath,
  pathOperations,
}: {
  readonly hookDirectory: string;
  readonly checkoutRoot: string;
  readonly pluginPath: readonly string[];
  readonly pathOperations: PathOperations;
}): string => {
  const hostDirectory = pathOperations.basename({ path: pathOperations.dirname({ path: hookDirectory }) });
  return hostDirectory.startsWith(".")
    ? pathOperations.join({ segments: [checkoutRoot, hostDirectory, ...pluginPath] })
    : pathOperations.join({ segments: [checkoutRoot, "plugins", "rin", ...pluginPath] });
};

export type {
  ConstitutionGatePorts,
  EngineReading,
  GateDecision,
  GatedCompletion,
  GateRunVerdict,
  WalkerGateOutcome,
};
export {
  checkoutPluginPathOf,
  constitutionEngineFromWire,
  constitutionGateDecisionOf,
  engineReadingOf,
  gatedCompletionOf,
  gateRunVerdictOf,
  walkerGateOutcomeOf,
};
