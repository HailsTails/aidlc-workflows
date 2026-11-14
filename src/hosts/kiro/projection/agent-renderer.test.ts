import { describe, expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import {
  kiroAgentRenderer,
  kiroCliAgentRenderer,
  type KiroAgentProfile,
  type KiroModelSurface,
} from "./agent-renderer.ts";

const architect: Agent = {
  slug: brand<AgentSlug>("aidlc-architect-agent"),
  source: brand<MethodSourcePath>("agents/aidlc-architect-agent.md"),
  displayName: "Architect Agent",
  description: "Solutions architect.",
  owner: { kind: "core" },
  model: { kind: "tier", tier: "judgment" },
  examples: [],
  tools: { disallowed: ["Task"] },
  maxTurns: null,
  persona: { text: "# Architect Agent\n", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] },
};

const SURFACED = "---\nname: aidlc-architect-agent\nmodel: claude-opus-4.5\n---\n# Architect Agent\n";

const surfacing: KiroModelSurface = () => accepted(SURFACED);

describe("kiroAgentRenderer", () => {
  test("writes the persona to .kiro/agents with Kiro's prompt lines closing its frontmatter", () => {
    expect(kiroCliAgentRenderer(surfacing)({ agent: architect, knowledge: [] })).toMatchObject({
      ok: true,
      value: [
        {
          path: ".kiro/agents/aidlc-architect-agent.md",
          content: {
            kind: "text",
            text:
              "---\nname: aidlc-architect-agent\nmodel: claude-opus-4.5\n" +
              'tools: ["read", "write", "shell"]\nincludeMcpJson: true\n---\n# Architect Agent\n',
          },
          mode: "regular",
          origin: { kind: "method-source", path: architect.source },
        },
      ],
    });
  });

  test("asks the model surface to drop the Task denial, which Kiro's agent files reject", () => {
    const surface = mock(surfacing);
    kiroCliAgentRenderer(surface)({ agent: architect, knowledge: [] });

    expect(surface).toHaveBeenCalledWith({ agent: architect, removeKeys: ["disallowedTools"] });
  });
});

describe("kiroAgentRenderer refusals", () => {
  test("refuses an agent that denies anything but Task", () => {
    expect(
      kiroCliAgentRenderer(surfacing)({
        agent: { ...architect, tools: { disallowed: ["Task", "Bash"] } },
        knowledge: [],
      }),
    ).toEqual({
      ok: false,
      refusal: {
        kind: "render-failed",
        concept: "agent",
        name: "aidlc-architect-agent",
        reason: "Kiro needs the agent to deny exactly one tool, Task, and nothing else.",
      },
    });
  });

  test("refuses an agent that denies no tool", () => {
    expect(
      kiroCliAgentRenderer(surfacing)({
        agent: { ...architect, tools: { disallowed: [] } },
        knowledge: [],
      }),
    ).toMatchObject({ ok: false, refusal: { kind: "render-failed" } });
  });

  test("refuses an agent that already declares a key Kiro's prompt lines add", () => {
    expect(
      kiroCliAgentRenderer(() => accepted("---\nname: x\ntools: []\n---\nbody\n"))({
        agent: architect,
        knowledge: [],
      }),
    ).toMatchObject({
      ok: false,
      refusal: { reason: 'The agent already declares "tools:", which Kiro\'s prompt lines add.' },
    });
  });

  test("passes on the model surface's own refusal", () => {
    const tierless = {
      kind: "render-failed",
      concept: "agent",
      name: "aidlc-architect-agent",
      reason: "No model tier.",
    } as const;

    expect(kiroCliAgentRenderer(() => refused(tierless))({ agent: architect, knowledge: [] })).toEqual({
      ok: false,
      refusal: tierless,
    });
  });
});

const PERMISSIONS = ["includeMcpJson: true", "permissions:", "  rules: []"];

const permitted = (inline: KiroAgentProfile["inlineReading"]): KiroAgentProfile => ({
  modelSurface: surfacing,
  promptLines: () => PERMISSIONS,
  inlineReading: inline,
});

describe("kiroAgentRenderer with permission lines", () => {
  test("keeps a copy without them for the lead that reads the persona inline", () => {
    expect(
      kiroAgentRenderer(permitted(() => "reads-inline"))({ agent: architect, knowledge: [] }),
    ).toMatchObject({
      ok: true,
      value: [
        {
          path: ".kiro/agents/aidlc-architect-agent.md",
          content: {
            text:
              "---\nname: aidlc-architect-agent\nmodel: claude-opus-4.5\n" +
              "includeMcpJson: true\npermissions:\n  rules: []\n---\n# Architect Agent\n",
          },
        },
        { path: ".kiro/aidlc-common/personas/aidlc-architect-agent.md", content: { text: SURFACED } },
      ],
    });
  });

  test("writes no copy for a persona only ever dispatched", () => {
    expect(
      kiroAgentRenderer(permitted(() => "dispatched-only"))({ agent: architect, knowledge: [] }),
    ).toMatchObject({ ok: true, value: [{ path: ".kiro/agents/aidlc-architect-agent.md" }] });
  });
});
