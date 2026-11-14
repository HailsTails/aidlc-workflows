import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { AgentRenderingInputs, HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import type { Harness } from "../../../projection/application/ports/harness.ts";
import { projectActiveMemoryReferences } from "../../../projection/domain/active-memory.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";

const COPILOT_WORKER_TOOLS: readonly string[] = ["read", "edit", "search", "execute", "web", "todo"];

type TaskDenial = "none" | "task-only" | "other";

const taskDenial = (agent: Agent): TaskDenial => {
  const { disallowed } = agent.tools;
  if (disallowed.length === 0) return "none";
  return disallowed.length === 1 && /^task$/i.test(disallowed[0]?.trim() ?? "") ? "task-only" : "other";
};

const renderFailed = (agent: Agent, reason: string): ProjectionRefusal => ({
  kind: "render-failed", concept: "agent", name: agent.slug, reason,
});

const workerTools = (denial: TaskDenial): readonly string[] =>
  denial === "task-only" ? [`tools: [${COPILOT_WORKER_TOOLS.map((tool) => `"${tool}"`).join(", ")}]`] : [];

const nativeDocument = (inputs: AgentRenderingInputs, request: { readonly agent: Agent; readonly denial: TaskDenial }) => inputs.documents({
  agent: request.agent, text: "authored-file", knowledge: "preflight-only", reading: "whole-files",
  frontmatter: { model: "omitted", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
    removeKeys: ["disallowedTools"], afterProjectionLines: workerTools(request.denial) },
});

const runtimeDocument = (inputs: AgentRenderingInputs, agent: Agent) => inputs.documents({
  agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
  frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
    removeKeys: [], afterProjectionLines: [] },
});

const renderAgent = (inputs: AgentRenderingInputs): Harness["renderAgent"] => ({ agent }) => {
  const denial = taskDenial(agent);
  if (denial === "other") return refused(renderFailed(agent,
    `Copilot can only project a Task denial, not: ${agent.tools.disallowed.join(", ")}.`));
  const native = nativeDocument(inputs, { agent, denial });
  if (!native.ok) return native;
  const runtime = runtimeDocument(inputs, agent);
  if (!runtime.ok) return runtime;
  const runtimePath = projectPath(`.aidlc/agents/${agent.slug}.md`);
  const nativePath = projectPath(`.github/agents/${agent.slug}.md`);
  if (!runtimePath.ok || !nativePath.ok) return refused(renderFailed(agent,
    "The Copilot agent destinations must be project-relative paths."));
  return accepted([
    { path: runtimePath.value, content: { kind: "text", text: projectActiveMemoryReferences(runtime.value) },
      mode: "regular", origin: { kind: "method-source", path: agent.source } },
    { path: nativePath.value, content: { kind: "text", text: projectActiveMemoryReferences(native.value) },
      mode: "regular", origin: { kind: "method-source", path: agent.source } },
  ]);
};

export const copilotAgents: HostAgentRenderer = (inputs) => ({
  renderAgent: renderAgent(inputs),
  renderConductorAgent: () => accepted([]),
});
