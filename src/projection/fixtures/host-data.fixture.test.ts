import { describe, expect, test } from "bun:test";
import { AUTHORED_PLACEMENTS_FIXTURE, claudeHostDataFixture, kiroHostDataFixture } from "./host-data.fixture.ts";

describe("host data fixtures", () => {
  test("give claude no rules folder and a hook recovery line that names the install's command", () => {
    expect(claudeHostDataFixture).toMatchObject({
      rulesFolder: null,
      hookActivation: { recovery: expect.stringContaining("{{INVOKE}}") },
    });
  });

  test("give kiro its steering folder, its layout, a tool-prefixed recovery line and plugin frontmatter per channel", () => {
    expect(kiroHostDataFixture).toMatchObject({
      rulesFolder: "steering",
      kiroLayout: "agent-v1",
      hookActivation: { recovery: expect.stringContaining("{{TOOL_PREFIX}}") },
      pluginAgentFrontmatter: {
        copy: ["tools: [\"*\"]", "  - \"bun .kiro/tools/aidlc-*\""],
        native: ["tools: [\"*\"]", "  - \"aidlc engine *\""],
      },
    });
  });

  test("leave out the fields kiro does not set", () => {
    expect(kiroHostDataFixture).not.toHaveProperty("statusLine");
  });
});

describe("AUTHORED_PLACEMENTS_FIXTURE", () => {
  test("places a file inside the host folder and two at the project root", () => {
    expect(AUTHORED_PLACEMENTS_FIXTURE).toEqual([
      { source: "settings.local.json.example", destination: ".claude/settings.local.json.example" },
      { source: ".mcp.json", destination: ".mcp.json" },
      { source: "dot-gitignore", destination: ".gitignore" },
    ]);
  });
});
