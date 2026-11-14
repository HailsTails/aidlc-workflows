import { describe, expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { AgentDocumentSurface } from "../../../projection/application/ports/agents.ts";
import { SCRATCH_AGENT_INPUTS } from "../../../projection/fixtures/scratch-host.fixture.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { copilotAgents } from "./agent-renderer.ts";

const delivery: Agent = {
  slug: brand<AgentSlug>("aidlc-delivery-agent"),
  source: brand<MethodSourcePath>("aidlc-common/agents/aidlc-delivery-agent.md"),
  displayName: "Delivery Agent",
  description: "Plans the delivery.",
  owner: { kind: "core" },
  model: { kind: "tier", tier: "templated" },
  examples: [],
  tools: { disallowed: ["Task"] },
  maxTurns: null,
  persona: { text: "# Delivery Agent\n", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] },
};

const unrestricted: Agent = { ...delivery, tools: { disallowed: [] } };

const NATIVE = '---\nname: aidlc-delivery-agent\ntools: ["read"]\n---\nRead aidlc/spaces/<active-space>/memory/org.md first.\n';
const RUNTIME = "---\nname: aidlc-delivery-agent\ndisallowedTools: Task\n---\nRuntime. Read aidlc/spaces/<active-space>/memory/org.md first.\n";
const NATIVE_PLACED = '---\nname: aidlc-delivery-agent\ntools: ["read"]\n---\nRead aidlc/active-memory/org.md first.\n';
const RUNTIME_PLACED = "---\nname: aidlc-delivery-agent\ndisallowedTools: Task\n---\nRuntime. Read aidlc/active-memory/org.md first.\n";

const surfaces = () => mock().mockReturnValueOnce(accepted(NATIVE)).mockReturnValueOnce(accepted(RUNTIME));

const noFrontmatter = { kind: "render-failed", concept: "agent", name: "aidlc-delivery-agent", reason: "No frontmatter." } as const;

const render = (agent: Agent, documents: AgentDocumentSurface = surfaces()) =>
  copilotAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({ agent, knowledge: [] });

describe("copilotAgents", () => {
  test("places the runtime and native personas with the engine's copy of the active memory", () => {
    expect(render(delivery)).toEqual(accepted([
      { path: path(".aidlc/agents/aidlc-delivery-agent.md"), mode: "regular",
        origin: { kind: "method-source", path: delivery.source },
        content: { kind: "text", text: RUNTIME_PLACED } },
      { path: path(".github/agents/aidlc-delivery-agent.md"), mode: "regular",
        origin: { kind: "method-source", path: delivery.source },
        content: { kind: "text", text: NATIVE_PLACED } },
    ]));
  });

  test("requests the native persona preflight-only, model omitted, with the Task denial as a worker allowlist", () => {
    const documents = surfaces();
    render(delivery, documents);
    expect(documents).toHaveBeenCalledWith({
      agent: delivery, text: "authored-file", knowledge: "preflight-only", reading: "whole-files",
      frontmatter: { model: "omitted", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
        removeKeys: ["disallowedTools"],
        afterProjectionLines: ['tools: ["read", "edit", "search", "execute", "web", "todo"]'] },
    });
  });

  test("requests the runtime persona absorbed, with the projected model and its denial kept", () => {
    const documents = surfaces();
    render(delivery, documents);
    expect(documents).toHaveBeenCalledWith({
      agent: delivery, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
      frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
        removeKeys: [], afterProjectionLines: [] },
    });
  });

  test("an agent that denies nothing gets no native allowlist", () => {
    const documents = surfaces();
    render(unrestricted, documents);
    expect(documents).toHaveBeenCalledWith(expect.objectContaining({ knowledge: "preflight-only",
      frontmatter: expect.objectContaining({ afterProjectionLines: [] }) }));
  });

  test("has no separate conductor agent file", () => {
    expect(copilotAgents(SCRATCH_AGENT_INPUTS).renderConductorAgent({ knowledge: [] })).toEqual(accepted([]));
  });
});

describe("copilotAgents refusals", () => {
  test("refuses a denial Copilot cannot enforce before either surface runs", () => {
    const documents = surfaces();
    expect(render({ ...delivery, tools: { disallowed: ["Task", "WebSearch"] } }, documents)).toEqual(refused({
      kind: "render-failed", concept: "agent", name: "aidlc-delivery-agent",
      reason: "Copilot can only project a Task denial, not: Task, WebSearch." }));
    expect(documents).not.toHaveBeenCalled();
  });

  test("passes on the native surface's own refusal without a partial pair", () => {
    expect(render(delivery, mock(() => refused(noFrontmatter)))).toEqual(refused(noFrontmatter));
  });

  test("refuses the whole pair when the runtime surface refuses", () => {
    const documents = mock().mockReturnValueOnce(accepted(NATIVE)).mockReturnValueOnce(refused(noFrontmatter));
    expect(render(delivery, documents)).toEqual(refused(noFrontmatter));
  });

  test("refuses an invalid destination without emitting either surface", () => {
    expect(render({ ...delivery, slug: brand<AgentSlug>("../../escape") })).toEqual(refused({
      kind: "render-failed", concept: "agent", name: "../../escape",
      reason: "The Copilot agent destinations must be project-relative paths." }));
  });
});
