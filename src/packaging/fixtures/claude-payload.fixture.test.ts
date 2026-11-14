import { describe, expect, test } from "bun:test";
import { claudeCopyPayloadFixture } from "./claude-payload.fixture.ts";

const SHIPPED_FILES = [
  { path: ".claude/agents/aidlc-developer-agent.md", origin: { kind: "projected" } },
  { path: ".claude/aidlc-common/agents/aidlc-developer-agent.md", origin: { kind: "projected" } },
  { path: ".claude/skills/aidlc-code-generation/SKILL.md", origin: { kind: "projected" } },
  { path: ".claude/skills/aidlc-feature/SKILL.md", origin: { kind: "projected" } },
  {
    path: ".claude/aidlc-common/stages/construction/code-generation.md",
    origin: { kind: "projected" },
  },
  {
    path: ".claude/knowledge/aidlc-developer-agent/code-generation-guide.md",
    origin: { kind: "projected" },
  },
  { path: ".claude/settings.json", origin: { kind: "projected" } },
  { path: ".claude/CLAUDE.md", origin: { kind: "projected" } },
  { path: ".gitignore", origin: { kind: "projected" } },
  { path: ".claude/tools/aidlc.ts", origin: { kind: "bundled-runtime" } },
  { path: ".claude/tools/data/aidlc-version.json", origin: { kind: "version-stamp" } },
  { path: ".claude/tools/data/aidlc-projection.json", origin: { kind: "distribution-descriptor" } },
];

const BUNDLED_RUNTIME = {
  path: ".claude/tools/aidlc.ts",
  hash: "sha256:f3b2989724efbf7b154b10283b87780d53ee348055b20c76f86634ee512a2f93",
  content: { kind: "text", text: "#!/usr/bin/env bun\nexport {};\n" },
  mode: "executable",
  origin: {
    kind: "bundled-runtime",
    entry: { name: "aidlc", compositionRoot: "src/cli/main.ts" },
  },
};

const PROJECTED_GUIDE = {
  path: ".claude/knowledge/aidlc-developer-agent/code-generation-guide.md",
  hash: "sha256:6109428b0c94525fae102ff4175965ba17e5ae27a2c847bf4cbbfbe9638a4eb3",
  content: { kind: "text", text: "# Code Generation Guide\n" },
  mode: "regular",
  origin: {
    kind: "projected",
    origin: {
      kind: "method-source",
      path: "knowledge/aidlc-developer-agent/code-generation-guide.md",
    },
  },
};

const CLAUDE_DESCRIPTOR = {
  host: { distribution: "claude", directory: ".claude" },
  layout: { rootIntegrations: [{ path: ".gitignore" }, { path: ".mcp.json" }] },
  history: {
    retiredFiles: [
      {
        path: ".claude/skills/aidlc-legacy-runner/SKILL.md",
        shippedHashes: [
          "sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b",
        ],
      },
    ],
    priorIntegrations: [{ integration: ".gitignore" }, { integration: ".mcp.json" }],
  },
};

describe("claudeCopyPayloadFixture", () => {
  test("is the 2.12.0 copy-channel payload for the Claude host", () => {
    expect(claudeCopyPayloadFixture).toMatchObject({ version: "2.12.0", channel: "copy" });
  });

  test("ships every projected file followed by the runtime, stamp and descriptor", () => {
    expect(claudeCopyPayloadFixture.files).toMatchObject(SHIPPED_FILES);
  });

  test("bundles the CLI runtime as an executable from its composition root", () => {
    expect<readonly object[]>(claudeCopyPayloadFixture.files).toContainEqual(BUNDLED_RUNTIME);
  });

  test("hashes a projected file by its content", () => {
    expect<readonly object[]>(claudeCopyPayloadFixture.files).toContainEqual(PROJECTED_GUIDE);
  });

  test("carries the Claude host, layout and retired legacy runner in its descriptor", () => {
    expect(claudeCopyPayloadFixture.descriptor).toMatchObject(CLAUDE_DESCRIPTOR);
  });
});
