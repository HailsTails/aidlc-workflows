import { z } from "zod";
import { finding, type NativeTier, type Outcome, type Tier } from "../domain/model.ts";

export const qualityKnowledgeFiles = ["nfr-reliability-guide.md", "nfr-validation-methods.md", "test-strategy-patterns.md", "testing-guide.md"] as const;
export type SourceAssemblyLocation = { readonly sourceRoot: string; readonly runtimeRoot: string };
export type SourceAssemblySnapshot = { readonly agent: string; readonly skill: string; readonly graph: string; readonly knowledge: readonly { readonly name: string; readonly text: string }[]; readonly tiers: Readonly<Record<Tier, NativeTier>>; readonly frameworkVersion: string };
export type SourceAssemblyOperations = {
  readonly read: (input: { readonly root: string; readonly path: string }) => Promise<string>;
  readonly tiers: (input: { readonly root: string }) => Promise<unknown>;
};
export const createSourceAssemblyOperations = (): SourceAssemblyOperations => ({
  read: ({ root, path }) => Bun.file(`${root}/${path}`).text(),
  tiers: async ({ root }) => { const imported: unknown = await import(Bun.pathToFileURL(`${root}/core/tools/aidlc-tiers.ts`).href); return imported; },
});
const tier = z.object({ model: z.string().min(1), effort: z.string().nullable() });
const projectionKey = "TIER_PROJECTIONS";
const tiersSchema = z.object({ [projectionKey]: z.object({ judgment: z.object({ claude: tier }), balanced: z.object({ claude: tier }), templated: z.object({ claude: tier }) }) });
const identity = z.object({ schemaVersion: z.literal(1), distribution: z.literal("claude"), harnessDir: z.literal(".claude") });
const stampSchema = identity.extend({ frameworkVersion: z.string().min(1) });
const paths = ["core/agents/aidlc-quality-agent.md", "core/skills/aidlc-session-cost/SKILL.md", ".claude/tools/data/stage-graph.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json"] as const;
const decodeSnapshot = ({ texts, imported }: { readonly texts: readonly string[]; readonly imported: unknown }): Outcome<SourceAssemblySnapshot> => {
  const [agent, skill, graph, descriptor, stamp, harness] = texts;
  if (agent === undefined || skill === undefined || graph === undefined || descriptor === undefined || stamp === undefined || harness === undefined)
    return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "source-assembly", detail: "source preview requires all declared source and distribution inputs" })] };
  try {
    const descriptorJson: unknown = JSON.parse(descriptor), stampJson: unknown = JSON.parse(stamp), harnessJson: unknown = JSON.parse(harness);
    const parsedDescriptor = identity.safeParse(descriptorJson), parsedStamp = stampSchema.safeParse(stampJson), parsedHarness = identity.safeParse(harnessJson);
    if (!parsedDescriptor.success || !parsedStamp.success || !parsedHarness.success)
      return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "source-assembly", detail: "source preview requires matching existing Claude projection descriptor, stamp and harness identity" })] };
    const projectedTiers = tiersSchema.safeParse(imported);
    if (!projectedTiers.success)
      return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "source-assembly", detail: "source preview requires the source owner's Claude tier projection table" })] };
    const knowledge = qualityKnowledgeFiles.map((name, index) => ({ name, text: texts[paths.length + index] ?? "" }));
    if (knowledge.some((entry) => entry.text.trim().length === 0))
      return { status: "invalid", findings: [finding({ code: "missing-knowledge", subject: "aidlc-quality-agent", detail: "source preview requires all four authored quality knowledge files" })] };
    const table = projectedTiers.data[projectionKey];
    return { status: "ok", value: { agent, skill, graph, knowledge, tiers: { judgment: table.judgment.claude, balanced: table.balanced.claude, templated: table.templated.claude }, frameworkVersion: parsedStamp.data.frameworkVersion } };
  } catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "source-assembly", detail: "source preview requires JSON distribution identity files" })] }; }
};
export type SourceAssemblyReader = { readonly load: (input: SourceAssemblyLocation) => Promise<Outcome<SourceAssemblySnapshot>> };
export const createSourceAssemblyReader = ({ operations = createSourceAssemblyOperations() }: { readonly operations?: SourceAssemblyOperations } = {}): SourceAssemblyReader => ({
  load: async ({ sourceRoot, runtimeRoot }) => {
    try {
      const reads = [...paths.map((path, index) => operations.read({ root: index < 2 ? sourceRoot : runtimeRoot, path })), ...qualityKnowledgeFiles.map((name) => operations.read({ root: sourceRoot, path: `core/knowledge/aidlc-quality-agent/${name}` }))];
      const [texts, imported] = await Promise.all([Promise.all(reads), operations.tiers({ root: sourceRoot })]);
      return decodeSnapshot({ texts, imported });
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "source-assembly", detail: `source preview inputs unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
