import { mock } from "bun:test";
import type { AgentProjection } from "../src/domain/agent-definition.ts";
import type { ProjectionSet, ProjectionSetServices, ProjectionSetUnit, ProjectionSetValidation } from "../src/application/projection-set.ts";
import type { Finding } from "../src/domain/model.ts";
import { agentOrigin, claudeAgentContext, metricsAgent } from "./agent-fixtures.ts";
import { skillContext, skillEmission, skillOrigin, skillSourceText } from "./skill-fixtures.ts";

export const assemblyTarget = { harness: "claude", directory: ".claude" } as const;
export const assemblyResource = { kind: "file", path: ".claude/agents/test-pro-metrics-agent.md", body: "Native persona\n" } as const;
export const assemblyAgent: AgentProjection = { origin: agentOrigin, harness: "claude", participation: [], resources: [assemblyResource] };
export const assemblyAgentUnit: Extract<ProjectionSetUnit, { readonly kind: "agent" }> = { kind: "agent", key: "metrics", input: { agent: metricsAgent, context: claudeAgentContext, knowledge: [], stages: [] } };
export const assemblySkillUnit: Extract<ProjectionSetUnit, { readonly kind: "skill" }> = { kind: "skill", key: "session-cost", input: { text: skillSourceText, origin: skillOrigin, context: skillContext } };
export const assemblySkill = { ...skillEmission, origin: skillOrigin, harness: "claude", userInvocation: "enabled" } as const;
export const assemblyFailure = { status: "invalid", findings: [{ code: "capability-gap", subject: "restricted-agent", detail: "authored permission has no verified native mapping" }] } as const;
export const assemblySet: ProjectionSet = { scope: "selected-surfaces", target: assemblyTarget, units: [{ kind: "agent", key: "metrics", projection: assemblyAgent }], resources: [assemblyResource] };
export const createAssemblyServices = (): ProjectionSetServices => ({ sensor: mock().mockReturnValue(assemblyFailure), harnessDocument: mock().mockReturnValue(assemblyFailure), guidance: mock().mockReturnValue(assemblyFailure), knowledge: mock().mockReturnValue(assemblyFailure), stage: mock().mockReturnValue(assemblyFailure), scope: mock().mockReturnValue(assemblyFailure), agent: mock().mockReturnValue({ status: "ok", value: assemblyAgent }), compiledAgent: mock().mockReturnValue({ status: "ok", value: assemblyAgent }), skill: mock().mockReturnValue({ status: "ok", value: assemblySkill }), runners: mock().mockReturnValue({ status: "ok", value: { runners: [], resources: [] } }) });
export const createAssemblyValidation = (): ProjectionSetValidation => ({ collect: mock().mockReturnValue({ status: "ok", value: [assemblyResource] }), path: mock().mockReturnValue("safe"), residue: mock().mockReturnValue([]) });
export const invalidAssemblySelections: { readonly name: string; readonly units: readonly ProjectionSetUnit[]; readonly code: Finding["code"]; readonly subject: string; readonly detail: string }[] = [
  { name: "empty", units: [], code: "invalid-input", subject: "projection-set", detail: "select at least one projection unit" },
  { name: "duplicate key", units: [assemblyAgentUnit, assemblyAgentUnit], code: "duplicate", subject: "metrics", detail: "projection unit keys must be unique" },
  { name: "noncanonical key", units: [{ ...assemblyAgentUnit, key: "../metrics" }], code: "invalid-identifier", subject: "../metrics", detail: "projection unit keys must be canonical identifiers" },
  { name: "foreign harness", units: [{ ...assemblyAgentUnit, input: { ...assemblyAgentUnit.input, context: { ...claudeAgentContext, harness: "cursor", directory: ".cursor" } } }], code: "harness-mismatch", subject: "metrics", detail: "every selected unit must target the assembly's harness binding" },
];
export const configuredAssembly: ProjectionSet = { ...assemblySet, target: { harness: "opencode", directory: ".aidlc" }, units: [{ kind: "skill", key: "cost", projection: { ...assemblySkill, harness: "opencode", discovery: { kind: "configured-directory", root: ".aidlc/skills", config: "opencode.json" } } }, { kind: "skill", key: "cost-two", projection: { ...assemblySkill, harness: "opencode", discovery: { kind: "configured-directory", root: ".aidlc/skills", config: "opencode.json" } } }] };
