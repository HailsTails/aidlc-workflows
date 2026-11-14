import { SCRATCH_AGENT_INPUTS } from "../../../projection/fixtures/scratch-host.fixture.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { expect, test, mock } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agentSlug } from "../../../workflow-definition/domain/identities.ts";
import { methodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { openCodeAgents } from "./agent-renderer.ts";

const agent: Agent = {
  slug: accept(agentSlug("aidlc-example-agent")),
  source: accept(methodSourcePath({ kind: "agent", within: "aidlc-example-agent.md" })),
  displayName: "Example", description: "Example role", examples: [],
  owner: { kind: "core" }, model: { kind: "tier", tier: "balanced" },
  tools: { disallowed: ["Task"] }, maxTurns: 12,
  persona: { text: "Budget `maxTurns: 12`", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] },
};

test("native and inline personas request distinct frontmatters and retain exact separate bytes", () => {
  const documents = mock().mockReturnValueOnce(accepted("---\nmode: subagent\nsteps: 12\npermission:\n  task: deny\n---\n" +
    "Budget `maxTurns: 12`; aidlc/spaces/<active-space>/memory/project.md .aidlc/rules/aidlc-org.md " +
    ".aidlc/rules/aidlc-team.md .aidlc/rules/aidlc-project.md .aidlc/rules/other.md\n"))
    .mockReturnValueOnce(accepted("---\ndisallowedTools: Task\nmaxTurns: 12\n---\n" +
      "Budget `maxTurns: 12`; aidlc/spaces/<active-space>/memory/project.md .aidlc/rules/aidlc-org.md " +
      ".aidlc/rules/aidlc-team.md .aidlc/rules/aidlc-project.md .aidlc/rules/other.md\n"));
  const renderer = openCodeAgents({ ...SCRATCH_AGENT_INPUTS, documents });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(accepted([
    { path: path(".opencode/agents/aidlc-example-agent.md"), mode: "regular",
      origin: { kind: "method-source", path: agent.source }, content: { kind: "text", text:
        "---\nmode: subagent\nsteps: 12\npermission:\n  task: deny\n---\nBudget `steps: 12`; " +
        "aidlc/active-memory/project.md aidlc/active-memory/org.md aidlc/active-memory/team.md " +
        "aidlc/active-memory/project.md aidlc/active-memory/other.md\n" } },
    { path: path(".aidlc/agents/aidlc-example-agent.md"), mode: "regular",
      origin: { kind: "method-source", path: agent.source }, content: { kind: "text", text:
        "---\ndisallowedTools: Task\nmaxTurns: 12\n---\nBudget `maxTurns: 12`; " +
        "aidlc/active-memory/project.md aidlc/active-memory/org.md aidlc/active-memory/team.md " +
        "aidlc/active-memory/project.md aidlc/active-memory/other.md\n" } },
  ]));
  expect(documents).toHaveBeenNthCalledWith(1, { agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
    frontmatter: { model: "projected", effortKey: "variant", modelQuoting: "plain", insertBeforeKeys: [],
      removeKeys: ["disallowedTools", "maxTurns"], afterProjectionLines: [
        "mode: subagent", "steps: 12", "permission:", "  task: deny",
      ] } });
  expect(documents).toHaveBeenNthCalledWith(2, { agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
    frontmatter: { model: "projected", effortKey: "variant", modelQuoting: "plain", insertBeforeKeys: [],
      removeKeys: [], afterProjectionLines: [] } });
  expect(documents).toHaveBeenCalledTimes(2);
});

test("the registered factory keeps optional cap and denial lines absent", () => {
  const documents = mock(() => accepted("Persona\n"));
  const uncapped = { ...agent, maxTurns: null, tools: { disallowed: [] } };
  expect(openCodeAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({ agent: uncapped, knowledge: [] }).ok)
    .toBe(true);
  expect(documents).toHaveBeenNthCalledWith(1, { agent: uncapped, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
    frontmatter: { model: "projected", effortKey: "variant", modelQuoting: "plain", insertBeforeKeys: [],
      removeKeys: ["disallowedTools", "maxTurns"], afterProjectionLines: ["mode: subagent"] } });
});

test("the registered factory refuses unsupported denials before any document call", () => {
  const documents = mock(() => accepted("Unused"));
  expect(openCodeAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({
    agent: { ...agent, tools: { disallowed: ["Read"] } }, knowledge: [],
  })).toEqual(refused({ kind: "render-failed", concept: "agent", name: "aidlc-example-agent",
    reason: "OpenCode cannot translate disallowedTools without Task: Read." }));
  expect(documents).not.toHaveBeenCalled();
});

test("a native document refusal prevents the inline document request", () => {
  const refusal: ProjectionRefusal = { kind: "render-failed", concept: "agent", name: agent.slug, reason: "Native refused" };
  const documents = mock(() => refused(refusal));
  expect(openCodeAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
  expect(documents).toHaveBeenCalledTimes(1);
});

test("an inline document refusal returns no partial native file", () => {
  const refusal: ProjectionRefusal = { kind: "render-failed", concept: "agent", name: agent.slug, reason: "Inline refused" };
  const documents = mock().mockReturnValueOnce(accepted("Native\n")).mockReturnValueOnce(refused(refusal));
  expect(openCodeAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
  expect(documents).toHaveBeenCalledTimes(2);
});

test("OpenCode has no separate conductor agent file", () => {
  expect(openCodeAgents(SCRATCH_AGENT_INPUTS).renderConductorAgent({ knowledge: [] })).toEqual(accepted([]));
});

test("the native factory retains mixed Task denial translation", () => {
  const documents = mock(() => accepted("Native task denial\n"));
  const mixed = { ...agent, tools: { disallowed: ["Read", "task"] } };
  expect(openCodeAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({
    agent: mixed, knowledge: [],
  }).ok).toBe(true);
  expect(documents).toHaveBeenNthCalledWith(1, { agent: mixed, text: "authored-file", knowledge: "absorbed",
    reading: "whole-files", frontmatter: { model: "projected", effortKey: "variant", modelQuoting: "plain",
      insertBeforeKeys: [], removeKeys: ["disallowedTools", "maxTurns"],
      afterProjectionLines: ["mode: subagent", "steps: 12", "permission:", "  task: deny"] } });
});
