import { describe, expect, test } from "bun:test";
import { AgentFileSchema } from "./agent-file.ts";

const READABLE_AGENTS = [
  {
    shape: "a core agent",
    text: `{
      "name": "aidlc-developer-agent", "display_name": "Developer Agent",
      "examples": ["db-conventions.md", "error-handling.md"],
      "description": "Senior developer responsible for code generation and data modelling.",
      "disallowedTools": "Task", "tier": "judgment"
    }`,
  },
  {
    shape: "a review agent with a turn limit",
    text: `{
      "name": "aidlc-product-lead-agent", "display_name": "Product Lead",
      "description": "Senior product leader who reviews requirements and user stories.",
      "disallowedTools": "Task", "tier": "balanced", "maxTurns": 60
    }`,
  },
  {
    shape: "a plugin agent with no tier",
    text: `{
      "name": "test-pro-metrics-agent", "display_name": "Test Pro Metrics Agent",
      "plugin": "test-pro", "examples": ["methodology.md"],
      "description": "Testing metrics specialist responsible for coverage interpretation.",
      "disallowedTools": "Task"
    }`,
  },
];

const REFUSED_AGENTS = [
  {
    shape: "a tier it does not know",
    text: `{
      "name": "aidlc-developer-agent", "display_name": "Dev", "description": "Dev",
      "tier": "fast"
    }`,
    issues: [{ code: "invalid_value", path: ["tier"] }],
  },
  {
    shape: "a name that is not kebab case",
    text: '{ "name": "DeveloperAgent", "display_name": "Dev", "description": "Dev" }',
    issues: [{ code: "invalid_format", path: ["name"] }],
  },
  {
    shape: "a turn limit of zero",
    text: `{
      "name": "aidlc-product-lead-agent", "display_name": "Lead", "description": "Lead",
      "maxTurns": 0
    }`,
    issues: [{ code: "too_small", path: ["maxTurns"] }],
  },
  {
    shape: "an agent without a display name",
    text: '{ "name": "aidlc-developer-agent", "description": "Developer" }',
    issues: [{ code: "invalid_type", path: ["display_name"] }],
  },
];

describe("AgentFileSchema", () => {
  test.each(READABLE_AGENTS)("reads $shape", ({ text }) => {
    expect(AgentFileSchema.parse(JSON.parse(text))).toEqual(JSON.parse(text));
  });

  test.each(REFUSED_AGENTS)("refuses $shape", ({ text, issues }) => {
    expect(AgentFileSchema.safeParse(JSON.parse(text))).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});
