import { describe, expect, test } from "bun:test";
import { claudeLayoutFixture, claudePriorIntegrationsFixture } from "./claude-layout.fixture.ts";

describe("claudeLayoutFixture", () => {
  test("integrates the gitignore block and the MCP server map at the project root", () => {
    expect(claudeLayoutFixture.rootIntegrations).toMatchObject([
      {
        path: ".gitignore",
        policy: "managed-block",
        marker: "gitignore",
        sharing: "union",
        presence: "required",
      },
      { path: ".mcp.json", policy: "json-map", key: "mcpServers", presence: "optional" },
    ]);
  });

  test("owns the shipped files of .claude and the whole of its method folders", () => {
    expect(claudeLayoutFixture.managedDirectories).toMatchObject([
      { path: ".claude", ownership: "shipped-files-only" },
      { path: ".claude/aidlc-common", ownership: "whole-directory" },
      { path: ".claude/knowledge", ownership: "whole-directory" },
      { path: ".claude/tools", ownership: "whole-directory" },
    ]);
  });
});

describe("claudePriorIntegrationsFixture", () => {
  test("remembers earlier whole gitignore files and an earlier MCP server entry", () => {
    expect(claudePriorIntegrationsFixture).toMatchObject([
      {
        integration: ".gitignore",
        wholeFileHashes: [
          "sha256:3da36b2d01551aeae2e366caa08be8cce0dbc9110e252445dcaa4e758e24a0b6",
          "sha256:4f1cd2e930bd37d2f5d715a06ea3fa1e2d39479fc662f0f0562116376132114b",
        ],
        entryHashes: {},
      },
      {
        integration: ".mcp.json",
        wholeFileHashes: [],
        entryHashes: {
          context7: ["sha256:8a440d21705f35c8f5649f118d17f786e08d589fb2dd888f5de5aa503233afbf"],
        },
      },
    ]);
  });
});
