import { expect, test } from "bun:test";
import { kiroWorkerCases, kasWorkerCases } from "../__tests__/worker-source-cases.ts";
import { successful } from "../__tests__/support.ts";
import { parseAgentSource, parseAgentStage } from "../src/adapters/agent-source.ts";
import { parseWorkerAdmissions } from "../src/adapters/worker-admissions.ts";
import { bindWorkerAdmissions } from "../src/domain/worker-policy.ts";
import { parseKiroAgentProfile, specializeKiroWorkerProfile, prepareKiroAgentProfile, kiroCopyCommandPatterns, createKiroAgentEmitter } from "../src/adapters/kiro-agent.ts";
import { parseKasWorkerPolicy, specializeKasWorkerPolicy, createKasAgentEmitter } from "../src/adapters/kas-agent.ts";
import { projectAgentDefinition } from "./agent-projection.ts";

test.each(kiroWorkerCases)("composition: $baseline Kiro metrics worker requires an explicit complete target policy and real grants", (entry) => {
  const agent = successful(parseAgentSource(entry.source));
  const profile = successful(parseKiroAgentProfile({ text: entry.profileText, origin: entry.policyOrigin }));
  const templateAdmissions = successful(parseWorkerAdmissions({ ...entry.templateAdmissions, input: entry.templateAdmissions.verbs }));
  const targetAdmissions = successful(parseWorkerAdmissions({ ...entry.targetAdmissions, input: entry.targetAdmissions.verbs }));
  const binding = successful(bindWorkerAdmissions({ template: profile, target: agent, templateAdmissions, targetAdmissions }));
  const targetProfile = successful(parseKiroAgentProfile(entry.target));
  const specialized = successful(specializeKiroWorkerProfile({ profile, binding, targetProfile, targetBasis: entry.target.basis }));
  const shellCommands = kiroCopyCommandPatterns({ dispatcherCommands: entry.dispatcherCommands, toolScripts: entry.toolScripts, dialect: entry.commandDialect });
  const prepared = successful(prepareKiroAgentProfile({ profile: specialized, shellCommands, sharedResources: entry.sharedResources, invocation: entry.context.invocation, hookSuffix: entry.hookSuffix }));
  const stage = successful(parseAgentStage({ text: entry.source.stageText, origin: entry.source.stageOrigin }));
  const projected = successful(projectAgentDefinition({ agent, context: entry.context, knowledge: entry.source.knowledge, stages: [stage], emitter: createKiroAgentEmitter({ profile: prepared, promptAdditions: entry.promptAdditions }) }));
  expect(projected.resources).toEqual(entry.expected);
  expect(projected.participation).toEqual([{ origin: entry.source.stageOrigin, stage: "test-pro-integration", mode: "inline", role: "support" }]);
  expect(specialized.binding.authority).toEqual(entry.targetAdmissions.origin);
});
test.each(kasWorkerCases)("composition: $baseline KAS metrics worker matches an explicit complete target permission declaration", (entry) => {
  const agent = successful(parseAgentSource(entry.source));
  const policy = successful(parseKasWorkerPolicy({ input: entry.policyLines, origin: entry.policyOrigin, name: entry.templateName }));
  const templateAdmissions = successful(parseWorkerAdmissions({ ...entry.templateAdmissions, input: entry.templateAdmissions.verbs }));
  const targetAdmissions = successful(parseWorkerAdmissions({ ...entry.targetAdmissions, input: entry.targetAdmissions.verbs }));
  const binding = successful(bindWorkerAdmissions({ template: policy, target: agent, templateAdmissions, targetAdmissions }));
  const targetPolicy = successful(parseKasWorkerPolicy({ input: entry.target.lines, origin: entry.target.origin, name: agent.name }));
  const specialized = successful(specializeKasWorkerPolicy({ policy, binding, targetPolicy, targetBasis: entry.target.basis }));
  const stage = successful(parseAgentStage({ text: entry.source.stageText, origin: entry.source.stageOrigin }));
  const projected = successful(projectAgentDefinition({ agent, context: entry.context, knowledge: entry.source.knowledge, stages: [stage], emitter: createKasAgentEmitter({ policy: specialized }) }));
  expect(projected.resources).toEqual(entry.expected);
  expect(entry.denialComparison).toBe("equivalent");
});
test.each(kiroWorkerCases)("composition: $baseline source role privileges cannot masquerade as an ordinary worker", (entry) => {
  const agent = successful(parseAgentSource(entry.source));
  expect(bindWorkerAdmissions({ template: { name: entry.templateName, origin: entry.policyOrigin }, target: agent, templateAdmissions: entry.templateAdmissions, targetAdmissions: { ...entry.targetAdmissions, verbs: entry.admissionMismatch } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: agent.name, detail: "worker policy reuse requires equivalent command admissions; select or prepare a role-specific policy" }] });
});
