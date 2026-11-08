import { describe, expect, test } from "bun:test";
import { AgentFileSchema, type AgentFile } from "./agent-file.ts";

const developerAgent: AgentFile = {
  name: "aidlc-developer-agent",
  display_name: "Developer Agent",
  examples: ["db-conventions.md", "error-handling.md"],
  description:
    "Senior developer responsible for code generation, reverse engineering, and data " +
    "modelling.\n",
  disallowedTools: "Task",
  tier: "judgment",
};

const productLeadAgent: AgentFile = {
  name: "aidlc-product-lead-agent",
  display_name: "Product Lead",
  description:
    "Senior product leader who reviews requirements, user stories, and UX artifacts.\n",
  disallowedTools: "Task",
  tier: "balanced",
  maxTurns: 60,
};

const pluginAgent: AgentFile = {
  name: "test-pro-metrics-agent",
  display_name: "Test Pro Metrics Agent",
  plugin: "test-pro",
  examples: ["methodology.md"],
  description: "Testing metrics specialist responsible for coverage interpretation.\n",
  disallowedTools: "Task",
};

describe("AgentFileSchema", () => {
  test("reads a core agent's frontmatter", () => {
    expect(AgentFileSchema.parse(developerAgent)).toEqual(developerAgent);
  });

  test("reads a review agent with a turn limit", () => {
    expect(AgentFileSchema.parse(productLeadAgent)).toEqual(productLeadAgent);
  });

  test("reads a plugin agent with no tier", () => {
    expect(AgentFileSchema.parse(pluginAgent)).toEqual(pluginAgent);
  });

  test("refuses a tier it does not know", () => {
    expect(AgentFileSchema.safeParse({ ...developerAgent, tier: "fast" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["tier"] }] },
    });
  });

  test("refuses a name that is not kebab case", () => {
    expect(AgentFileSchema.safeParse({ ...developerAgent, name: "DeveloperAgent" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["name"] }] },
    });
  });

  test("refuses a turn limit of zero", () => {
    expect(AgentFileSchema.safeParse({ ...productLeadAgent, maxTurns: 0 })).toMatchObject({
      success: false,
      error: { issues: [{ code: "too_small", path: ["maxTurns"] }] },
    });
  });

  test("refuses an agent without a display name", () => {
    expect(
      AgentFileSchema.safeParse({ name: developerAgent.name, description: "Developer" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_type", path: ["display_name"] }] },
    });
  });
});
