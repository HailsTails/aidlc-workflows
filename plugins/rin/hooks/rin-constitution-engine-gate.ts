import type { GateDecision } from "./rin-constitution-engine-gate-decision.ts";

const BLOCKING_EXIT_CODE = 2;

const gateDecisionOf = async ({ hookInput }: { readonly hookInput: string }): Promise<GateDecision> => {
  const { constitutionGateDecisionOf } = await import("./rin-constitution-engine-gate-decision.ts");
  const { defaultConstitutionGatePorts } = await import("./rin-constitution-engine-gate-ports.ts");
  return constitutionGateDecisionOf({
    hookInput,
    ports: defaultConstitutionGatePorts({ hookModuleUrl: import.meta.url }),
  });
};

const gateFailureDecisionOf = ({
  hookInput,
  failure,
}: {
  readonly hookInput: string;
  readonly failure: unknown;
}): GateDecision =>
  hookInput.includes("report") && hookInput.includes("--result")
    ? {
        kind: "deny",
        reason: `Blocked: stage completion refused. The constitution gate failed before it reached a verdict, so this stage is unverified, not passing: ${String(failure)}\n`,
      }
    : { kind: "allow" };

const decisionOrGateFailureOf = async ({ hookInput }: { readonly hookInput: string }): Promise<GateDecision> => {
  try {
    return await gateDecisionOf({ hookInput });
  } catch (failure) {
    return gateFailureDecisionOf({ hookInput, failure });
  }
};

try {
  if (!process.stdin.isTTY) {
    const decision = await decisionOrGateFailureOf({ hookInput: await Bun.stdin.text() });
    if (decision.kind === "deny") {
      process.stderr.write(decision.reason);
      process.exitCode = BLOCKING_EXIT_CODE;
    }
  }
} catch (failure) {
  process.stderr.write(`Blocked: the constitution gate could not run at all: ${String(failure)}\n`);
  process.exitCode = BLOCKING_EXIT_CODE;
}
