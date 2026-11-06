import { mock, type Mock } from "bun:test";
import type { SourceAssemblyOperations, SourceAssemblySnapshot } from "../src/adapters/source-assembly-reader.ts";
import type { SourceAssemblyDependencies } from "../examples/source-assembly.ts";
import { assemblyAgentUnit, assemblySet, assemblyTarget } from "./projection-set-fixtures.ts";
import { metricsSource, claudeAgentContext } from "./agent-fixtures.ts";
import { skillSourceText } from "./skill-fixtures.ts";

export const sourceAssemblyArguments = { sourceRoot: "source", runtimeRoot: "runtime", pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", sharedKnowledge: "all", showFile: null } as const;
export const sourcePreparationSnapshot: SourceAssemblySnapshot = { agent: "---\nname: aidlc-quality-agent\ndisplay_name: Quality Agent\ndescription: Quality specialist\ntier: judgment\ndisallowedTools: Task\n---\nQuality\n", skill: skillSourceText, graph: "[]", knowledge: [], tiers: claudeAgentContext.models.tiers, frameworkVersion: "0.1.0" };
export const sourceAssemblySnapshot: SourceAssemblySnapshot = { agent: metricsSource, skill: skillSourceText, graph: "[]", knowledge: [{ name: "nfr-reliability-guide.md", text: "Reliability" }, { name: "nfr-validation-methods.md", text: "Validation" }, { name: "test-strategy-patterns.md", text: "Strategy" }, { name: "testing-guide.md", text: "Testing" }], tiers: claudeAgentContext.models.tiers, frameworkVersion: "0.1.0" };
const tierKey = "TIER_PROJECTIONS";
export const sourceAssemblyTiers = { [tierKey]: { judgment: { claude: { model: "inherit", effort: null } }, balanced: { claude: { model: "sonnet", effort: "medium" } }, templated: { claude: { model: "inherit", effort: null } } } };
export const sourceIdentityText = '{"schemaVersion":1,"distribution":"claude","harnessDir":".claude"}';
export const sourceStampText = '{"schemaVersion":1,"distribution":"claude","harnessDir":".claude","frameworkVersion":"0.1.0"}';
export const sourceReadTexts = [metricsSource, skillSourceText, "[]", sourceIdentityText, sourceStampText, sourceIdentityText, "Reliability", "Validation", "Strategy", "Testing"];
type SourceReadMock = Mock<SourceAssemblyOperations["read"]>;
export const createSourceReadMock = ({ texts = sourceReadTexts }: { readonly texts?: readonly string[] } = {}): SourceReadMock => {
  const read = mock<SourceAssemblyOperations["read"]>();
  texts.forEach((text) => read.mockResolvedValueOnce(text));
  return read;
};
export const foreignSourceTexts = sourceReadTexts.map((text, index) => index === 5 ? '{"schemaVersion":1,"distribution":"cursor","harnessDir":".cursor"}' : text);
export const malformedSourceTexts = sourceReadTexts.map((text, index) => index === 3 ? "{" : text);
export const emptyKnowledgeTexts = sourceReadTexts.map((text, index) => index === 9 ? " " : text);
export const sourceAssemblyRequest = { target: assemblyTarget, units: [assemblyAgentUnit] };
export const createSourceAssemblyDependenciesFixture = (): SourceAssemblyDependencies => ({ parse: mock().mockReturnValue({ status: "ok", value: sourceAssemblyArguments }), reader: { load: mock().mockResolvedValue({ status: "ok", value: sourceAssemblySnapshot }) }, compiler: mock().mockReturnValue({ compile: mock().mockReturnValue({ status: "ok", value: [] }) }), prepare: mock().mockReturnValue({ status: "ok", value: sourceAssemblyRequest }), project: mock().mockReturnValue({ status: "ok", value: assemblySet }), format: mock().mockReturnValue({ status: "ok", value: "inventory\n" }), reporter: { finish: mock() } });
