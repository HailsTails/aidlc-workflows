import { describe, expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { cursorAgentRenderer } from "./agent-renderer.ts";

const quality: Agent = {
  slug: brand<AgentSlug>("aidlc-quality-agent"),
  source: brand<MethodSourcePath>("agents/aidlc-quality-agent.md"),
  displayName: "Quality Agent",
  description: "Tests the work.",
  owner: { kind: "core" },
  model: { kind: "tier", tier: "judgment" },
  examples: [],
  tools: { disallowed: ["Task"] },
  maxTurns: null,
  persona: { text: "# Quality Agent\n", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] },
};

const SURFACED =
  "---\nname: aidlc-quality-agent\ndisallowedTools: Task\n---\n" +
  "Read aidlc/spaces/<active-space>/memory/team.md first.\n";

const tierless = {
  kind: "render-failed",
  concept: "agent",
  name: "aidlc-quality-agent",
  reason: "No tier.",
} as const;

describe("cursorAgentRenderer", () => {
  test("writes a native subagent that reads the engine's copy of the active memory", () => {
    expect(
      cursorAgentRenderer(() => accepted(SURFACED))({ agent: quality, knowledge: [] }),
    ).toMatchObject({
      ok: true,
      value: [
        {
          path: ".cursor/agents/aidlc-quality-agent.md",
          content: {
            kind: "text",
            text:
              "---\nname: aidlc-quality-agent\ndisallowedTools: Task\n---\n" +
              "Read aidlc/active-memory/team.md first.\n",
          },
          mode: "regular",
          origin: { kind: "method-source", path: "agents/aidlc-quality-agent.md" },
          availability: "always",
        },
      ],
    });
  });

  test("hands the agent to the model surface as it is", () => {
    const surface = mock(() => accepted(SURFACED));
    cursorAgentRenderer(surface)({ agent: quality, knowledge: [] });

    expect(surface).toHaveBeenCalledWith({ agent: quality });
  });

  test("passes on the model surface's own refusal", () => {
    expect(cursorAgentRenderer(() => refused(tierless))({ agent: quality, knowledge: [] })).toEqual({
      ok: false,
      refusal: tierless,
    });
  });
});
