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

const surfaces = () => mock<AgentDocumentSurface>()
  .mockReturnValueOnce(accepted(NATIVE)).mockReturnValueOnce(accepted(RUNTIME));

const noFrontmatter = { kind: "render-failed", concept: "agent", name: "aidlc-delivery-agent", reason: "No frontmatter." } as const;

const render = (agent: Agent, documents: AgentDocumentSurface = surfaces()) =>
  copilotAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({ agent, knowledge: [] });

const preparedDocument = { agent: delivery.slug,
  content: "---\nname: Example\ntier: balanced\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n",
  model: {} };

test("the actual native and companion renderer callbacks preserve different host meanings", () => {
  const documents = surfaces();
  render(delivery, documents);
  expect(documents.mock.calls[0]?.[0].render(preparedDocument)).toEqual(accepted(
    '---\nname: Example\ntools: ["read", "edit", "search", "execute", "web", "todo"]\nmaxTurns: 12\n---\nPersona\n'));
  expect(documents.mock.calls[1]?.[0].render(preparedDocument)).toEqual(accepted(
    "---\nname: Example\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n"));
});

test("the unrestricted native callback omits worker tools rather than selecting the companion", () => {
  const documents = surfaces();
  render(unrestricted, documents);
  expect(documents.mock.calls[0]?.[0].render(preparedDocument)).toEqual(accepted(
    "---\nname: Example\nmaxTurns: 12\n---\nPersona\n"));
});

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

  test("requests the native persona with its reviewer knowledge absorbed, model omitted, with the Task denial as a worker allowlist", () => {
    const documents = surfaces();
    render(delivery, documents);
    expect(documents).toHaveBeenCalledWith({
      agent: delivery, text: "authored-file", knowledge: "absorbed", reading: { kind: "whole-files" },
      model: "omitted", render: expect.any(Function),
    });
  });

  test("requests the runtime persona absorbed, with the projected model and its denial kept", () => {
    const documents = surfaces();
    render(delivery, documents);
    expect(documents).toHaveBeenCalledWith({
      agent: delivery, text: "authored-file", knowledge: "absorbed", reading: { kind: "whole-files" },
      model: "projected", render: expect.any(Function),
    });
  });

  test("an agent that denies nothing gets no native allowlist", () => {
    const documents = surfaces();
    render(unrestricted, documents);
    expect(documents).toHaveBeenCalledWith(expect.objectContaining({ knowledge: "absorbed",
      model: "omitted", render: expect.any(Function) }));
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
