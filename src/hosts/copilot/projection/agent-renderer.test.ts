import { describe, expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import type { ProjectPath } from "../../../kernel/values.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { copilotAgentRenderer, type CopilotModelSurface,
  type CopilotRuntimeSurface } from "./agent-renderer.ts";

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

const surfacing: CopilotModelSurface = () => accepted(
  '---\nname: aidlc-delivery-agent\ntools: ["read"]\n---\n' +
  "Read aidlc/spaces/<active-space>/memory/org.md first.\n",
);

const runtimeSurfacing: CopilotRuntimeSurface = () => accepted(
  "---\nname: aidlc-delivery-agent\ndisallowedTools: Task\n---\n" +
  "Runtime knowledge. Read aidlc/spaces/<active-space>/memory/org.md first.\n",
);

const noFrontmatter = {
  kind: "render-failed",
  concept: "agent",
  name: "aidlc-delivery-agent",
  reason: "No frontmatter.",
} as const;

describe("copilotAgentRenderer", () => {
  test("keeps runtime and native policies distinct and places both active-memory personas", () => {
    expect(copilotAgentRenderer(surfacing, runtimeSurfacing)({ agent: delivery, knowledge: [] })).toEqual({
      ok: true,
      value: [
        {
          path: brand<ProjectPath>(".aidlc/agents/aidlc-delivery-agent.md"),
          content: {
            kind: "text",
            text: "---\nname: aidlc-delivery-agent\ndisallowedTools: Task\n---\n" +
              "Runtime knowledge. Read aidlc/active-memory/org.md first.\n",
          },
          mode: "regular",
          origin: { kind: "method-source", path: brand<MethodSourcePath>("aidlc-common/agents/aidlc-delivery-agent.md") },
          availability: "always",
        },
        {
          path: brand<ProjectPath>(".github/agents/aidlc-delivery-agent.md"),
          content: {
            kind: "text",
            text: '---\nname: aidlc-delivery-agent\ntools: ["read"]\n---\n' +
              "Read aidlc/active-memory/org.md first.\n",
          },
          mode: "regular",
          origin: { kind: "method-source", path: brand<MethodSourcePath>("aidlc-common/agents/aidlc-delivery-agent.md") },
          availability: "always",
        },
      ],
    });
  });

  test("turns the Task denial into a native allowlist without Copilot's agent tool", () => {
    const surface = mock(surfacing);
    const runtime = mock(runtimeSurfacing);
    copilotAgentRenderer(surface, runtime)({ agent: delivery, knowledge: [] });
    expect(surface).toHaveBeenCalledWith({
      agent: delivery,
      removeKeys: ["disallowedTools"],
      afterProjectionLines: ['tools: ["read", "edit", "search", "execute", "web", "todo"]'],
    });
    expect(runtime).toHaveBeenCalledWith({ agent: delivery });
  });

  test("an agent that denies nothing gets no native allowlist", () => {
    const surface = mock(surfacing);
    copilotAgentRenderer(surface, runtimeSurfacing)({ agent: unrestricted, knowledge: [] });
    expect(surface).toHaveBeenCalledWith({
      agent: unrestricted,
      removeKeys: ["disallowedTools"],
      afterProjectionLines: [],
    });
  });
});

describe("copilotAgentRenderer refusals", () => {
  test("refuses a denial Copilot cannot enforce before either surface runs", () => {
    const surface = mock(surfacing);
    const runtime = mock(runtimeSurfacing);
    expect(copilotAgentRenderer(surface, runtime)({
      agent: { ...delivery, tools: { disallowed: ["Task", "WebSearch"] } },
      knowledge: [],
    })).toEqual({
      ok: false,
      refusal: {
        kind: "render-failed",
        concept: "agent",
        name: "aidlc-delivery-agent",
        reason: "Copilot can only project a Task denial, not: Task, WebSearch.",
      },
    });
    expect(surface).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
  });

  test("passes on the native surface's own refusal", () => {
    expect(copilotAgentRenderer(() => refused(noFrontmatter), runtimeSurfacing)({
      agent: delivery, knowledge: [],
    })).toEqual({ ok: false, refusal: noFrontmatter });
  });

  test("refuses the whole pair when the runtime surface refuses", () => {
    expect(copilotAgentRenderer(surfacing, () => refused(noFrontmatter))({
      agent: delivery, knowledge: [],
    })).toEqual({ ok: false, refusal: noFrontmatter });
  });

  test("refuses an invalid destination without emitting either surface", () => {
    expect(copilotAgentRenderer(surfacing, runtimeSurfacing)({
      agent: { ...delivery, slug: brand<AgentSlug>("../../escape") },
      knowledge: [],
    })).toEqual({
      ok: false,
      refusal: {
        kind: "render-failed",
        concept: "agent",
        name: "../../escape",
        reason: "The Copilot agent destinations must be project-relative paths.",
      },
    });
  });
});
