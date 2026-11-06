import { describe, expect, test } from "bun:test";
import type { AgentModelChoice } from "./agent-definition.ts";
import { claudeAgentContext, cursorAgentContext } from "../../__tests__/agent-fixtures.ts";
import { resolveAgentModel } from "./agent-model-policy.ts";

describe("native agent model policy", () => {
  test.each([
    {
      label: "caller-supplied fork policy pins judgment to opus",
      choice: { kind: "tier", tier: "judgment" } satisfies AgentModelChoice,
      context: {
        ...claudeAgentContext,
        models: {
          ...claudeAgentContext.models,
          tiers: { ...claudeAgentContext.models.tiers, judgment: { model: "opus", effort: null } },
        },
      },
      expected: { model: "opus", effort: null },
    },
    {
      label: "explicit Claude alias",
      choice: { kind: "explicit", model: "sonnet" } satisfies AgentModelChoice,
      context: claudeAgentContext,
      expected: { model: "sonnet", effort: null },
    },
    {
      label: "judgment inherits",
      choice: { kind: "tier", tier: "judgment" } satisfies AgentModelChoice,
      context: claudeAgentContext,
      expected: { model: "inherit", effort: null },
    },
    {
      label: "balanced effort",
      choice: { kind: "tier", tier: "balanced" } satisfies AgentModelChoice,
      context: claudeAgentContext,
      expected: { model: "sonnet", effort: "medium" },
    },
    {
      label: "capped judgment",
      choice: { kind: "tier", tier: "judgment" } satisfies AgentModelChoice,
      context: { ...claudeAgentContext, tierCap: "balanced" } as const,
      expected: { model: "sonnet", effort: "medium" },
    },
    {
      label: "templated cap",
      choice: { kind: "tier", tier: "balanced" } satisfies AgentModelChoice,
      context: { ...claudeAgentContext, tierCap: "templated" } as const,
      expected: { model: "inherit", effort: null },
    },
    {
      label: "explicit alias has no artificial tier",
      choice: { kind: "explicit", model: "sonnet" } satisfies AgentModelChoice,
      context: { ...claudeAgentContext, tierCap: "templated" } as const,
      expected: { model: "sonnet", effort: null },
    },
    {
      label: "Cursor tier inherits",
      choice: { kind: "tier", tier: "judgment" } satisfies AgentModelChoice,
      context: cursorAgentContext,
      expected: { model: null, effort: null },
    },
    {
      label: "Cursor plugin inherits",
      choice: { kind: "explicit", model: "sonnet" } satisfies AgentModelChoice,
      context: cursorAgentContext,
      expected: { model: null, effort: null },
    },
  ])("$label", ({ choice, context, expected }) => {
    expect(resolveAgentModel({ choice, context })).toEqual(expected);
  });
});
