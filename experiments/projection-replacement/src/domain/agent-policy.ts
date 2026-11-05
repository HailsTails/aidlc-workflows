import type { AgentContext, AuthoredAgent, AgentExecutionPolicy } from "./agent-definition.ts";
import { finding, type Outcome } from "./model.ts";

export const resolveAgentPolicy = ({ agent, context }: {
  readonly agent: AuthoredAgent;
  readonly context: AgentContext;
}): Outcome<AgentExecutionPolicy> => {
  const findings = [
    ...(agent.policy.ambientInstructions === "omit-claude-md" ? ["omitClaudeMd"] : []),
    ...(agent.policy.tools.kind === "allow" && context.harness !== "claude" ? ["tools allowlist"] : []),
    ...(agent.policy.turnLimit !== null && context.harness !== "claude" && context.harness !== "opencode" ? ["maxTurns"] : []),
  ].map((field) => finding({ code: "capability-gap", subject: agent.name, detail: `${context.harness} has no verified native projection for authored ${field}; prepare an explicit compatible policy before projecting this agent` }));
  if (findings.length > 0) return { status: "invalid", findings };
  return { status: "ok", value: agent.policy };
};
