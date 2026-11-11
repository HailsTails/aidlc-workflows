import { describe, expect, mock, test } from "bun:test";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { brand } from "../../../kernel/brand.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { SCRATCH_AGENT_INPUTS } from "../../../projection/fixtures/scratch-host.fixture.ts";
import { cursorAgents } from "./agent-renderer.ts";

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

describe("cursorAgents", () => {
  test("writes a native subagent that reads the engine's copy of the active memory", () => {
    expect(
      cursorAgents({ ...SCRATCH_AGENT_INPUTS, documents: () => accepted(SURFACED) }).renderAgent({ agent: quality, knowledge: [] }),
    ).toMatchObject({
      ok: true,
      value: [
        {
          path: path(".cursor/agents/aidlc-quality-agent.md"),
          content: {
            kind: "text",
            text:
              "---\nname: aidlc-quality-agent\ndisallowedTools: Task\n---\n" +
              "Read aidlc/active-memory/team.md first.\n",
          },
          mode: "regular",
          origin: { kind: "method-source", path: quality.source },
          availability: "always",
        },
      ],
    });
  });

  test("hands the agent to the model surface as it is", () => {
    const surface = mock(() => accepted(SURFACED));
    cursorAgents({ ...SCRATCH_AGENT_INPUTS, documents: surface }).renderAgent({ agent: quality, knowledge: [] });

    expect(surface).toHaveBeenCalledWith(expect.objectContaining({ agent: quality }));
  });

  test("passes on the model surface's own refusal", () => {
    expect(cursorAgents({ ...SCRATCH_AGENT_INPUTS, documents: () => refused(tierless) }).renderAgent({ agent: quality, knowledge: [] })).toEqual({
      ok: false,
      refusal: tierless,
    });
  });
});

test("Cursor's agent factory requests the exact authored effort surface before its memory rewrite", () => {
  const documents = mock(() => accepted(SURFACED));
  expect(cursorAgents({ ...SCRATCH_AGENT_INPUTS, documents }).renderAgent({ agent: quality, knowledge: [] })).toEqual(
    accepted([{
      path: path(".cursor/agents/aidlc-quality-agent.md"),
      content: { kind: "text", text: "---\nname: aidlc-quality-agent\ndisallowedTools: Task\n---\nRead aidlc/active-memory/team.md first.\n" },
      mode: "regular", availability: "always",
      origin: { kind: "method-source", path: quality.source },
    }]),
  );
  expect(documents).toHaveBeenCalledWith({
    agent: quality, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
    frontmatter: {
      model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
      removeKeys: [], afterProjectionLines: [],
    },
  });
});

test("Cursor's factory preserves a shared document refusal without a partial file", () => {
  expect(cursorAgents({ ...SCRATCH_AGENT_INPUTS, documents: () => refused(tierless) })
    .renderAgent({ agent: quality, knowledge: [] })).toEqual(refused(tierless));
});

test("Cursor has no separate conductor agent file", () => {
  expect(cursorAgents(SCRATCH_AGENT_INPUTS).renderConductorAgent({ knowledge: [] })).toEqual(accepted([]));
});
