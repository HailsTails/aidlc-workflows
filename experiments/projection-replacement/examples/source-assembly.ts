import { parseAgentSource } from "../src/adapters/agent-source.ts";
import { parseCompiledAgentStages } from "../src/adapters/compiled-agent-stages.ts";
import { createLegacyRunnerCompiler } from "../src/adapters/legacy-runner-compiler.ts";
import { createSourceAssemblyReader, type SourceAssemblyReader, type SourceAssemblySnapshot } from "../src/adapters/source-assembly-reader.ts";
import { parseSourceAssemblyArguments } from "../src/adapters/source-assembly-input.ts";
import { createSourceAssemblyReporter, type SourceAssemblyReporter } from "../src/adapters/source-assembly-reporter.ts";
import type { SourceOrigin } from "../src/domain/source-origin.ts";
import type { RunnerCompiler } from "../src/domain/generated-runner.ts";
import type { ProjectionSetRequest } from "../src/application/projection-set.ts";
import { formatProjectionSet } from "../src/application/projection-set-view.ts";
import { projectProjectionSet } from "./projection-set.ts";
import type { Outcome } from "../src/domain/model.ts";

const target = { harness: "claude", directory: ".claude" } as const;
const origin = ({ path, pin }: { readonly path: string; readonly pin: string }): SourceOrigin => ({ source: { kind: "core", id: "framework" }, pin, path });
export const createSourceAssemblyCompiler = ({ runtimeRoot, pin }: { readonly runtimeRoot: string; readonly pin: string }): RunnerCompiler =>
  createLegacyRunnerCompiler({ runtime: { root: runtimeRoot, binding: target }, compiler: origin({ pin, path: "core/tools/aidlc-runner-gen.ts" }) });
export const prepareSourceAssembly = ({ snapshot, pin, compiler, sharedKnowledge }: { readonly snapshot: SourceAssemblySnapshot; readonly pin: string; readonly compiler: RunnerCompiler; readonly sharedKnowledge: "all" | "methodology-only" }): Outcome<ProjectionSetRequest> => {
  const agent = parseAgentSource({ text: snapshot.agent, origin: origin({ pin, path: "core/agents/aidlc-quality-agent.md" }) });
  if (agent.status === "invalid") return agent;
  const catalogue = parseCompiledAgentStages({ text: snapshot.graph, artifact: origin({ pin, path: ".claude/tools/data/stage-graph.json" }), binding: target, sources: [{ source: { kind: "core", id: "framework" }, pin }] });
  if (catalogue.status === "invalid") return catalogue;
  return { status: "ok", value: { target, units: [
    { kind: "compiled-agent", key: "quality", input: { agent: agent.value, catalogue: catalogue.value, knowledge: snapshot.knowledge.map((entry) => ({ origin: origin({ pin, path: `core/knowledge/aidlc-quality-agent/${entry.name}` }), body: entry.text })), context: { ...target, invocation: "bun .claude/tools/aidlc.ts", tierCap: "judgment", sharedKnowledge, rulesSubdir: "rules", knowledgeRead: "ordinary", memoryReference: null, models: { tiers: snapshot.tiers, explicit: "preserve" } } } },
    { kind: "skill", key: "session-cost", input: { text: snapshot.skill, origin: origin({ pin, path: "core/skills/aidlc-session-cost/SKILL.md" }), context: { ...target, invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", memoryRoot: "aidlc/active-memory", modelInvocation: "native-default" } } },
    { kind: "runners", key: "workflow", input: { compiler, context: { ...target, modelInvocation: "native-default" }, requests: [{ kind: "stage", slug: "code-generation" }, { kind: "scope", scope: "bugfix" }, { kind: "init" }, { kind: "compose" }] } },
  ] } };
};
export type SourceAssemblyDependencies = { readonly parse: typeof parseSourceAssemblyArguments; readonly reader: SourceAssemblyReader; readonly compiler: typeof createSourceAssemblyCompiler; readonly prepare: typeof prepareSourceAssembly; readonly project: typeof projectProjectionSet; readonly format: typeof formatProjectionSet; readonly reporter: SourceAssemblyReporter };
export const createSourceAssemblyDependencies = (): SourceAssemblyDependencies => ({ parse: parseSourceAssemblyArguments, reader: createSourceAssemblyReader(), compiler: createSourceAssemblyCompiler, prepare: prepareSourceAssembly, project: projectProjectionSet, format: formatProjectionSet, reporter: createSourceAssemblyReporter() });
export const previewSourceAssembly = async ({ argv, dependencies = createSourceAssemblyDependencies() }: { readonly argv: readonly string[]; readonly dependencies?: SourceAssemblyDependencies }): Promise<void> => {
  const parsed = dependencies.parse({ argv });
  if (parsed.status === "invalid") return dependencies.reporter.finish({ outcome: parsed });
  const snapshot = await dependencies.reader.load(parsed.value);
  if (snapshot.status === "invalid") return dependencies.reporter.finish({ outcome: snapshot });
  const compiler = dependencies.compiler(parsed.value);
  const prepared = dependencies.prepare({ snapshot: snapshot.value, pin: parsed.value.pin, sharedKnowledge: parsed.value.sharedKnowledge, compiler });
  if (prepared.status === "invalid") return dependencies.reporter.finish({ outcome: prepared });
  const projected = dependencies.project(prepared.value);
  if (projected.status === "invalid") return dependencies.reporter.finish({ outcome: projected });
  dependencies.reporter.finish({ outcome: dependencies.format({ projection: projected.value, showFile: parsed.value.showFile }) });
};
if (import.meta.main) await previewSourceAssembly({ argv: Bun.argv.slice(2) });
