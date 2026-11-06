import { coreSensorSet, coreSensorInputs } from "./core-sensor-fixtures.ts";
import { mock } from "bun:test";
import type { CoreDocumentServices } from "../examples/core-authored-documents.ts";
import type { PreparedCoreAgentPolicy } from "../src/domain/core-agent-policy.ts";
import type { CompiledWorkflowSource } from "../src/domain/workflow-compilation.ts";
import type { ProjectionSet } from "../src/application/projection-set.ts";
import { coreAgentBasis, coreAgentContext, coreAgentCatalogue, coreAgentSet, coreAgentInputs, coreAgentOrigin, coreAgentArtifact, coreAgentKnowledgeOrigin } from "./core-agent-fixtures.ts";
import { coreSkillSet, coreSkillSources } from "./core-skill-fixtures.ts";
import { coreKnowledgeSet, coreKnowledgeSources } from "./core-knowledge-fixtures.ts";
import { guidanceSet, preparedGuidance } from "./core-guidance-fixtures.ts";
import { entrySet, preparedEntries } from "./harness-document-fixtures.ts";

import { onboardingSet, onboardingInputs } from "./onboarding-fixtures.ts";
export const documentContext = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", optionLetters: "A-E" } as const;
export const documentPolicyOrigin = { ...coreAgentBasis, path: "core/tools/data/model-policy.json" };
export const documentPolicy: PreparedCoreAgentPolicy = { tierCap: "balanced", models: coreAgentContext.models, inputs: [{ path: "core/tools/data/model-policy.json", sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" }], origins: [documentPolicyOrigin] };
export const documentWorkflow: CompiledWorkflowSource = { binding: { harness: "claude", directory: ".claude" }, compiler: { ...coreAgentBasis, path: "core/tools/aidlc-compile.ts" }, graph: { origin: coreAgentArtifact, text: "Fresh compiled stages" }, grid: { origin: { ...coreAgentBasis, path: ".claude/tools/data/scope-grid.json" }, text: "Fresh compiled grid" }, inputs: [] };
export const documentAgentSet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [{ kind: "compiled-agent", key: "agent-aidlc-note-agent", projection: { origin: coreAgentOrigin, harness: "claude", resources: [{ kind: "file", path: ".claude/agents/aidlc-note-agent.md", body: "Prepared agent" }], participation: [], dependencies: [coreAgentArtifact, coreAgentKnowledgeOrigin, documentPolicyOrigin] } }], resources: [{ kind: "file", path: ".claude/agents/aidlc-note-agent.md", body: "Prepared agent" }] };
export const documentDigest = [{ path: "combined-source-witness", sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" }];
export const documentRequest = { sourceRoot: "authored-source", workRoot: "prepared-workspace", basis: coreAgentBasis, context: documentContext, workflow: documentWorkflow, mode: 0o640 };
export const createCoreDocumentFixture = (): CoreDocumentServices => ({
  policy: { load: mock().mockResolvedValue({ status: "ok", value: documentPolicy }) },
  catalogue: mock().mockReturnValue({ status: "ok", value: coreAgentCatalogue }),
  sensors: mock().mockResolvedValue({ status: "ok", value: { projection: coreSensorSet, inputs: coreSensorInputs, products: [] } }),
  skills: mock().mockResolvedValue({ status: "ok", value: { projection: coreSkillSet, inputs: coreSkillSources.inputs, products: [] } }),
  knowledge: mock().mockResolvedValue({ status: "ok", value: { projection: coreKnowledgeSet, inputs: coreKnowledgeSources.inputs, products: [] } }),
  agents: mock().mockResolvedValue({ status: "ok", value: { projection: coreAgentSet, inputs: coreAgentInputs.agents.inputs, products: [] } }),
  guidance: mock().mockResolvedValue({ status: "ok", value: { projection: guidanceSet, inputs: preparedGuidance.inputs, products: [] } }),
  entries: mock().mockResolvedValue({ status: "ok", value: { projection: entrySet, inputs: preparedEntries.inputs, products: [] } }),
  onboarding: mock().mockResolvedValue({ status: "ok", value: { projection: onboardingSet, inputs: onboardingInputs } }),
  combine: mock().mockReturnValue({ status: "ok", value: guidanceSet }),
  digests: mock().mockReturnValue({ status: "ok", value: documentDigest }),
});
