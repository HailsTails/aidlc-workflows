import { expect, test } from "bun:test";
import { composerPolicyCases, architectPolicySource, forkKiroWorker, forkKasWorker } from "../__tests__/worker-native-review-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { parseAgentSource } from "../src/adapters/agent-source.ts";
import { bindWorkerAdmissions } from "../src/domain/worker-policy.ts";
import { parseKiroAgentProfile, specializeKiroWorkerProfile, prepareKiroAgentProfile, kiroCopyCommandPatterns, createKiroAgentEmitter } from "../src/adapters/kiro-agent.ts";
import { parseKasWorkerPolicy, specializeKasWorkerPolicy, createKasAgentEmitter } from "../src/adapters/kas-agent.ts";
import { projectAgentDefinition } from "./agent-projection.ts";

test.each(composerPolicyCases)("composition: Kiro rejects quality grants for $label despite equal command admissions", (entry) => {
  const agent = successful(parseAgentSource(entry));
  const profile = successful(parseKiroAgentProfile({ text: forkKiroWorker.profileText, origin: forkKiroWorker.policyOrigin }));
  const targetProfile = successful(parseKiroAgentProfile({ text: entry.profileText, origin: entry.profileOrigin }));
  const binding = successful(bindWorkerAdmissions({ template: profile, target: agent, templateAdmissions: forkKiroWorker.templateAdmissions, targetAdmissions: entry.admissions }));
  expect(specializeKiroWorkerProfile({ profile, binding, targetProfile })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: entry.expectedName, detail: "Kiro native policies differ in writePaths, resources; preserve the target policy or prepare explicit source-backed differences" }] });
});
test.each(composerPolicyCases)("composition: KAS rejects quality grants for $label despite equal command admissions", (entry) => {
  const agent = successful(parseAgentSource(entry));
  const policy = successful(parseKasWorkerPolicy({ input: forkKasWorker.policyLines, origin: forkKasWorker.policyOrigin, name: forkKasWorker.templateName }));
  const targetPolicy = successful(parseKasWorkerPolicy({ input: entry.policyLines, origin: entry.policyOrigin, name: entry.expectedName }));
  const binding = successful(bindWorkerAdmissions({ template: policy, target: agent, templateAdmissions: forkKasWorker.templateAdmissions, targetAdmissions: entry.admissions }));
  expect(specializeKasWorkerPolicy({ policy, binding, targetPolicy })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: entry.expectedName, detail: "KAS native policies differ; preserve the target permissions or prepare explicit source-backed differences" }] });
});
test("composition: actual compatible architect Kiro policy preserves its native JSON output", () => {
  const agent = successful(parseAgentSource(architectPolicySource));
  const profile = successful(parseKiroAgentProfile({ text: forkKiroWorker.profileText, origin: forkKiroWorker.policyOrigin }));
  const targetProfile = successful(parseKiroAgentProfile({ text: architectPolicySource.profileText, origin: architectPolicySource.profileOrigin }));
  const binding = successful(bindWorkerAdmissions({ template: profile, target: agent, templateAdmissions: forkKiroWorker.templateAdmissions, targetAdmissions: architectPolicySource.admissions }));
  const specialized = successful(specializeKiroWorkerProfile({ profile, binding, targetProfile }));
  const shellCommands = kiroCopyCommandPatterns({ dispatcherCommands: forkKiroWorker.dispatcherCommands, toolScripts: forkKiroWorker.toolScripts, dialect: forkKiroWorker.commandDialect });
  const prepared = successful(prepareKiroAgentProfile({ profile: specialized, shellCommands, sharedResources: forkKiroWorker.sharedResources, invocation: forkKiroWorker.context.invocation, hookSuffix: forkKiroWorker.hookSuffix }));
  const projected = successful(projectAgentDefinition({ agent, context: forkKiroWorker.context, knowledge: [], stages: [], emitter: createKiroAgentEmitter({ profile: prepared, promptAdditions: forkKiroWorker.promptAdditions }) }));
  expect(projected.resources[1]?.body).toEqual(architectPolicySource.expectedJson);
  expect(specialized.targetOrigin).toEqual(architectPolicySource.profileOrigin);
});
test("composition: actual compatible architect KAS policy preserves its native Markdown output", () => {
  const agent = successful(parseAgentSource(architectPolicySource));
  const policy = successful(parseKasWorkerPolicy({ input: forkKasWorker.policyLines, origin: forkKasWorker.policyOrigin, name: forkKasWorker.templateName }));
  const targetPolicy = successful(parseKasWorkerPolicy({ input: architectPolicySource.policyLines, origin: architectPolicySource.policyOrigin, name: architectPolicySource.name }));
  const binding = successful(bindWorkerAdmissions({ template: policy, target: agent, templateAdmissions: forkKasWorker.templateAdmissions, targetAdmissions: architectPolicySource.admissions }));
  const specialized = successful(specializeKasWorkerPolicy({ policy, binding, targetPolicy }));
  const projected = successful(projectAgentDefinition({ agent, context: forkKasWorker.context, knowledge: [], stages: [], emitter: createKasAgentEmitter({ policy: specialized }) }));
  expect(projected.resources[0]?.body).toEqual(architectPolicySource.expectedKas);
  expect(specialized.targetOrigin).toEqual(architectPolicySource.policyOrigin);
});
