import { coreSensorSet, coreSensorInputs } from "../__tests__/core-sensor-fixtures.ts";
import { prepareCoreSensorProducts } from "./core-sensor-products.ts";
import { expect, mock, test } from "bun:test";
import { createCoreDocumentServices, prepareCoreAuthoredDocuments } from "./core-authored-documents.ts";
import { prepareCoreSkillProducts } from "./core-skill-products.ts";
import { prepareCoreKnowledgeProducts } from "./core-knowledge-products.ts";
import { prepareCoreAgentProducts } from "./core-agent-products.ts";
import { prepareCoreGuidanceProducts } from "./core-guidance-products.ts";
import { prepareOnboardingProducts } from "./onboarding-products.ts";
import { onboardingSet, onboardingInputs } from "../__tests__/onboarding-fixtures.ts";
import { prepareHarnessDocumentProducts } from "./harness-document-products.ts";
import { parseCompiledAgentStages } from "../src/adapters/compiled-agent-stages.ts";
import { combineProjectionSets } from "../src/application/combine-projections.ts";
import { mergeSourceDigests } from "../src/domain/source-origin.ts";
import { createCoreDocumentFixture, documentRequest, documentContext, documentPolicy, documentWorkflow, documentAgentSet, documentDigest } from "../__tests__/core-document-fixtures.ts";
import { coreAgentBasis, coreAgentCatalogue, coreAgentInputs } from "../__tests__/core-agent-fixtures.ts";
import { coreSkillSet, coreSkillSources } from "../__tests__/core-skill-fixtures.ts";
import { coreKnowledgeSet, coreKnowledgeSources } from "../__tests__/core-knowledge-fixtures.ts";
import { guidanceSet, preparedGuidance } from "../__tests__/core-guidance-fixtures.ts";
import { entrySet, preparedEntries } from "../__tests__/harness-document-fixtures.ts";

test("prepares all authored document owners with explicit contexts and fresh catalogue", async () => {
  const services = createCoreDocumentFixture();
  expect(await prepareCoreAuthoredDocuments({ ...documentRequest, services })).toEqual({ status: "ok", value: { projection: guidanceSet, inputs: documentDigest } });
  expect(services.policy.load).toHaveBeenCalledWith({ sourceRoot: "authored-source", basis: coreAgentBasis, binding: { harness: "claude", directory: ".claude" } });
  expect(services.catalogue).toHaveBeenCalledWith({ text: "Fresh compiled stages", artifact: documentWorkflow.graph.origin, binding: { harness: "claude", directory: ".claude" }, sources: [coreAgentBasis] });
  expect(services.skills).toHaveBeenCalledWith({ sourceRoot: "authored-source", basis: coreAgentBasis, mode: 0o640, context: { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", optionLetters: "A-E", memoryRoot: "aidlc/active-memory", modelInvocation: "native-default" } });
  expect(services.sensors).toHaveBeenCalledWith({ sourceRoot: "authored-source", basis: coreAgentBasis, mode: 0o640, context: documentContext });
  expect(services.sensors).toHaveBeenCalledTimes(1);
  expect(services.knowledge).toHaveBeenCalledWith({ sourceRoot: "authored-source", basis: coreAgentBasis, mode: 0o640, context: documentContext });
  expect(services.agents).toHaveBeenCalledWith({ sourceRoot: "authored-source", basis: coreAgentBasis, mode: 0o640, context: { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", optionLetters: "A-E", tierCap: "balanced", models: documentPolicy.models, sharedKnowledge: "methodology-only", knowledgeRead: "ordinary", memoryReference: null }, catalogue: coreAgentCatalogue });
  expect(services.guidance).toHaveBeenCalledWith({ sourceRoot: "authored-source", basis: coreAgentBasis, mode: 0o640, context: documentContext });
  expect(services.entries).toHaveBeenCalledWith({ sourceRoot: "authored-source", basis: coreAgentBasis, mode: 0o640, context: documentContext });
  expect(services.policy.load).toHaveBeenCalledTimes(1);
  expect(services.catalogue).toHaveBeenCalledTimes(1);
  expect(services.skills).toHaveBeenCalledTimes(1);
  expect(services.knowledge).toHaveBeenCalledTimes(1);
  expect(services.agents).toHaveBeenCalledTimes(1);
  expect(services.guidance).toHaveBeenCalledTimes(1);
  expect(services.entries).toHaveBeenCalledTimes(1);
  expect(services.onboarding).toHaveBeenCalledWith({ sourceRoot: "authored-source", workRoot: "prepared-workspace", basis: coreAgentBasis, mode: 0o640, context: documentContext });
  expect(services.onboarding).toHaveBeenCalledTimes(1);
});

test("retains policy origins only on the agent projection sent to the combiner", async () => {
  const services = createCoreDocumentFixture();
  await prepareCoreAuthoredDocuments({ ...documentRequest, services });
  expect(services.combine).toHaveBeenCalledWith({ target: { harness: "claude", directory: ".claude" }, sets: [coreSkillSet, coreKnowledgeSet, documentAgentSet, guidanceSet, entrySet, onboardingSet, coreSensorSet] });
  expect(services.combine).toHaveBeenCalledTimes(1);
});

test("passes raw policy and seven owner input groups to the digest collaborator", async () => {
  const services = createCoreDocumentFixture();
  await prepareCoreAuthoredDocuments({ ...documentRequest, services });
  expect(services.digests).toHaveBeenCalledWith({ groups: [documentPolicy.inputs, coreSkillSources.inputs, coreKnowledgeSources.inputs, coreAgentInputs.agents.inputs, preparedGuidance.inputs, preparedEntries.inputs, onboardingInputs, coreSensorInputs] });
  expect(services.digests).toHaveBeenCalledTimes(1);
});

test("policy refusal stops catalogue and all authored preparation", async () => {
  const services = { ...createCoreDocumentFixture(), policy: { load: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "policy", detail: "source policy unavailable" }] }) } };
  expect(await prepareCoreAuthoredDocuments({ ...documentRequest, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "policy", detail: "source policy unavailable" }] });
  expect(services.catalogue).not.toHaveBeenCalled();
  expect(services.skills).not.toHaveBeenCalled();
  expect(services.knowledge).not.toHaveBeenCalled();
  expect(services.agents).not.toHaveBeenCalled();
  expect(services.guidance).not.toHaveBeenCalled();
  expect(services.entries).not.toHaveBeenCalled();
  expect(services.sensors).not.toHaveBeenCalled();
  expect(services.digests).not.toHaveBeenCalled();
  expect(services.combine).not.toHaveBeenCalled();
});

test("catalogue refusal stops all authored preparation", async () => {
  const services = { ...createCoreDocumentFixture(), catalogue: mock().mockReturnValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "catalogue", detail: "wrong source graph" }] }) };
  expect(await prepareCoreAuthoredDocuments({ ...documentRequest, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "catalogue", detail: "wrong source graph" }] });
  expect(services.skills).not.toHaveBeenCalled();
  expect(services.knowledge).not.toHaveBeenCalled();
  expect(services.agents).not.toHaveBeenCalled();
  expect(services.guidance).not.toHaveBeenCalled();
  expect(services.entries).not.toHaveBeenCalled();
  expect(services.sensors).not.toHaveBeenCalled();
  expect(services.digests).not.toHaveBeenCalled();
  expect(services.combine).not.toHaveBeenCalled();
});

test.each([{ owner: "skills" }, { owner: "knowledge" }, { owner: "agents" }, { owner: "guidance" }, { owner: "entries" }, { owner: "onboarding" }, { owner: "sensors" }] as const)("one $owner refusal prevents partial combined output", async ({ owner }) => {
  const services = { ...createCoreDocumentFixture(), [owner]: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "owner", detail: "authored owner unavailable" }] }) };
  expect(await prepareCoreAuthoredDocuments({ ...documentRequest, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "owner", detail: "authored owner unavailable" }] });
  expect(services.digests).not.toHaveBeenCalled();
  expect(services.combine).not.toHaveBeenCalled();
});

test("digest conflict prevents projection combination", async () => {
  const services = { ...createCoreDocumentFixture(), digests: mock().mockReturnValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "digest", detail: "source bytes disagree" }] }) };
  expect(await prepareCoreAuthoredDocuments({ ...documentRequest, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "digest", detail: "source bytes disagree" }] });
  expect(services.combine).not.toHaveBeenCalled();
});

test("combination conflict refuses the whole authored document projection", async () => {
  const services = { ...createCoreDocumentFixture(), combine: mock().mockReturnValue({ status: "invalid", findings: [{ code: "destination-collision", subject: "projection", detail: "authored paths overlap" }] }) };
  expect(await prepareCoreAuthoredDocuments({ ...documentRequest, services })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "projection", detail: "authored paths overlap" }] });
});

test.each([{ context: { harness: "codex", directory: ".codex", invocation: "bun .codex/tools/aidlc.ts", rulesSubdir: "rules" } }, { context: { harness: "claude", directory: ".claude", invocation: "aidlc", rulesSubdir: "rules" } }] as const)("unsupported delivery refuses before source IO", async ({ context }) => {
  const services = createCoreDocumentFixture();
  expect(await prepareCoreAuthoredDocuments({ ...documentRequest, context, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-authored-documents", detail: "the authored Core document profile qualifies Claude Bun-copy delivery; no other harness policy is inferred" }] });
  expect(services.policy.load).not.toHaveBeenCalled();
  expect(services.catalogue).not.toHaveBeenCalled();
  expect(services.skills).not.toHaveBeenCalled();
  expect(services.knowledge).not.toHaveBeenCalled();
  expect(services.agents).not.toHaveBeenCalled();
  expect(services.guidance).not.toHaveBeenCalled();
  expect(services.entries).not.toHaveBeenCalled();
  expect(services.sensors).not.toHaveBeenCalled();
  expect(services.digests).not.toHaveBeenCalled();
  expect(services.combine).not.toHaveBeenCalled();
});

test("production services select the existing preparers and combiners", () => {
  expect(createCoreDocumentServices()).toEqual({ policy: { load: expect.any(Function) }, catalogue: parseCompiledAgentStages, sensors: prepareCoreSensorProducts, skills: prepareCoreSkillProducts, knowledge: prepareCoreKnowledgeProducts, agents: prepareCoreAgentProducts, guidance: prepareCoreGuidanceProducts, entries: prepareHarnessDocumentProducts, onboarding: prepareOnboardingProducts, combine: combineProjectionSets, digests: mergeSourceDigests });
});
