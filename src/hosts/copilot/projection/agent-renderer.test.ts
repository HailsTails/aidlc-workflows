import { describe, expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { copilotAgentRenderer, type CopilotModelSurface } from "./agent-renderer.ts";

const delivery: Agent = {
  slug: brand<AgentSlug>("aidlc-delivery-agent"),
  source: brand<MethodSourcePath>("agents/aidlc-delivery-agent.md"),
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

const SURFACED =
  '---\nname: aidlc-delivery-agent\ntools: ["read"]\n---\n' +
  "Read aidlc/spaces/<active-space>/memory/org.md first.\n";

const surfacing: CopilotModelSurface = () => accepted(SURFACED);

const noFrontmatter = {
  kind: "render-failed",
  concept: "agent",
  name: "aidlc-delivery-agent",
  reason: "No frontmatter.",
} as const;

describe("copilotAgentRenderer", () => {
  test("writes a custom agent that reads the engine's copy of the active memory", () => {
    expect(copilotAgentRenderer(surfacing)({ agent: delivery, knowledge: [] })).toMatchObject({
      ok: true,
      value: [
        {
          path: ".github/agents/aidlc-delivery-agent.md",
          content: {
            kind: "text",
            text:
              '---\nname: aidlc-delivery-agent\ntools: ["read"]\n---\n' +
              "Read aidlc/active-memory/org.md first.\n",
          },
          origin: { kind: "method-source", path: "agents/aidlc-delivery-agent.md" },
        },
      ],
    });
  });

  test("turns the Task denial into a worker allowlist without Copilot's agent tool", () => {
    const surface = mock(surfacing);
    copilotAgentRenderer(surface)({ agent: delivery, knowledge: [] });

    expect(surface).toHaveBeenCalledWith({
      agent: delivery,
      removeKeys: ["disallowedTools"],
      afterProjectionLines: ['tools: ["read", "edit", "search", "execute", "web", "todo"]'],
    });
  });

  test("an agent that denies nothing gets no allowlist", () => {
    const surface = mock(surfacing);
    copilotAgentRenderer(surface)({ agent: unrestricted, knowledge: [] });

    expect(surface).toHaveBeenCalledWith({
      agent: unrestricted,
      removeKeys: ["disallowedTools"],
      afterProjectionLines: [],
    });
  });
});

describe("copilotAgentRenderer refusals", () => {
  test("refuses a denial Copilot cannot enforce rather than ship it unenforced", () => {
    expect(
      copilotAgentRenderer(surfacing)({
        agent: { ...delivery, tools: { disallowed: ["Task", "WebSearch"] } },
        knowledge: [],
      }),
    ).toEqual({
      ok: false,
      refusal: {
        kind: "render-failed",
        concept: "agent",
        name: "aidlc-delivery-agent",
        reason: "Copilot can only project a Task denial, not: Task, WebSearch.",
      },
    });
  });

  test("passes on the model surface's own refusal", () => {
    expect(copilotAgentRenderer(() => refused(noFrontmatter))({ agent: delivery, knowledge: [] })).toEqual({
      ok: false,
      refusal: noFrontmatter,
    });
  });
});
