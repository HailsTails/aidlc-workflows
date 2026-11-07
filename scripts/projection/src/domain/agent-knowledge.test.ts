import { expect, test } from "bun:test";
import {
  integrationStage,
  methodologyKnowledge,
  metricsAgent,
} from "../../../../tests/unit/projection/support/__tests__/agent-fixtures.ts";
import { prepareAgentKnowledge, prepareAgentPersona } from "./agent-knowledge.ts";

test("reviewer participation embeds prepared knowledge with its authored source marker", () => {
  expect(prepareAgentPersona({ agent: { ...metricsAgent, body: "Role.\n" }, knowledge: [methodologyKnowledge], participation: [{ origin: integrationStage.origin, stage: "review", mode: "subagent", role: "reviewer" }] })).toBe("Role.\n\n---\n\n<!-- Absorbed at build time from knowledge/test-pro-metrics-agent/methodology.md - edit that file, not this generated copy. -->\n\n# Methodology\nCompare release evidence.\n");
});
test("a reviewer-like name without stage reviewer participation does not trigger absorption", () => {
  expect(prepareAgentPersona({ agent: { ...metricsAgent, name: "named-reviewer-agent", body: "Role.\n" }, knowledge: [methodologyKnowledge], participation: [] })).toBe("Role.\n");
});
test("reviewer participation without available knowledge preserves its body", () => {
  expect(prepareAgentPersona({ agent: { ...metricsAgent, body: "Role.\n" }, knowledge: [], participation: [{ origin: integrationStage.origin, stage: "review", mode: "subagent", role: "reviewer" }] })).toBe("Role.\n");
});

test("delivers source-local knowledge and leaves illustrative examples alone", () => {
  expect(
    prepareAgentKnowledge({
      agent: { ...metricsAgent, examples: ["absent-example.md"] },
      knowledge: [methodologyKnowledge],
    }),
  ).toEqual({ status: "ok", value: [methodologyKnowledge] });
});
test.each([
  {
    label: "parent traversal",
    path: "plugins/test-pro/knowledge/test-pro-metrics-agent/../methodology.md",
  },
  {
    label: "directory alias",
    path: "plugins/test-pro/knowledge/test-pro-metrics-agent/./methodology.md",
  },
  { label: "other persona", path: "plugins/test-pro/knowledge/other-agent/methodology.md" },
  {
    label: "nested directory",
    path: "plugins/test-pro/knowledge/test-pro-metrics-agent/nested/methodology.md",
  },
  {
    label: "Windows separator",
    path: "plugins/test-pro/knowledge/test-pro-metrics-agent/dir\\methodology.md",
  },
])("refuses $label without emitting knowledge", ({ path }) => {
  const knowledge = { ...methodologyKnowledge, origin: { ...methodologyKnowledge.origin, path } };
  expect(prepareAgentKnowledge({ agent: metricsAgent, knowledge: [knowledge] })).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-path",
        subject: path,
        detail:
          "expected a Markdown file directly under plugins/test-pro/knowledge/test-pro-metrics-agent/",
      },
    ],
  });
});
test.each([
  {
    label: "different owner",
    origin: { ...methodologyKnowledge.origin, source: { kind: "plugin", id: "other" } as const },
  },
  { label: "different pin", origin: { ...methodologyKnowledge.origin, pin: "cc6f50d6" } },
])("refuses $label", ({ origin }) => {
  expect(
    prepareAgentKnowledge({
      agent: metricsAgent,
      knowledge: [{ ...methodologyKnowledge, origin }],
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "foreign-content",
        subject: origin.path,
        detail: "knowledge must belong to the agent's source and pin",
      },
    ],
  });
});
test("refuses empty required content", () => {
  expect(
    prepareAgentKnowledge({
      agent: metricsAgent,
      knowledge: [{ ...methodologyKnowledge, body: "\n" }],
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "empty-knowledge",
        subject: methodologyKnowledge.origin.path,
        detail: "knowledge must contain text",
      },
    ],
  });
});
