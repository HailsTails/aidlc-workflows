import { describe, expect, test } from "bun:test";
import { claudeCopyPayloadFixture } from "./claude-payload.fixture.ts";

describe("claudeCopyPayloadFixture", () => {
  test("is the 2.12.0 copy-channel payload for the Claude host", () => {
    expect(claudeCopyPayloadFixture).toMatchObject({
      version: "2.12.0",
      channel: "copy",
      descriptor: { host: { distribution: "claude", directory: ".claude" } },
    });
  });

  test("ships every projected file followed by the runtime, stamp and descriptor", () => {
    expect(claudeCopyPayloadFixture.files.map((file) => file.path)).toEqual<string[]>([
      ".claude/agents/aidlc-developer-agent.md",
      ".claude/aidlc-common/agents/aidlc-developer-agent.md",
      ".claude/skills/aidlc-code-generation/SKILL.md",
      ".claude/skills/aidlc-feature/SKILL.md",
      ".claude/aidlc-common/stages/construction/code-generation.md",
      ".claude/knowledge/aidlc-developer-agent/code-generation-guide.md",
      ".claude/settings.json",
      ".claude/CLAUDE.md",
      ".gitignore",
      ".claude/tools/aidlc.ts",
      ".claude/tools/data/aidlc-version.json",
      ".claude/tools/data/aidlc-projection.json",
    ]);
  });

  test("records where each shipped file came from", () => {
    expect(claudeCopyPayloadFixture.files.map((file) => file.origin.kind)).toEqual([
      "projected",
      "projected",
      "projected",
      "projected",
      "projected",
      "projected",
      "projected",
      "projected",
      "projected",
      "bundled-runtime",
      "version-stamp",
      "distribution-descriptor",
    ]);
  });

  test("bundles the CLI runtime as an executable from its composition root", () => {
    expect<readonly object[]>(claudeCopyPayloadFixture.files).toContainEqual({
      path: ".claude/tools/aidlc.ts",
      hash: "sha256:f3b2989724efbf7b154b10283b87780d53ee348055b20c76f86634ee512a2f93",
      content: { kind: "text", text: "#!/usr/bin/env bun\nexport {};\n" },
      mode: "executable",
      origin: {
        kind: "bundled-runtime",
        entry: { name: "aidlc", compositionRoot: "src/cli/main.ts" },
      },
    });
  });

  test("hashes a projected file by its content", () => {
    expect<readonly object[]>(claudeCopyPayloadFixture.files).toContainEqual({
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
    });
  });

  test("carries the Claude layout and the retired legacy runner in its descriptor", () => {
    expect(claudeCopyPayloadFixture.descriptor).toMatchObject({
      layout: {
        rootIntegrations: [{ path: ".gitignore" }, { path: ".mcp.json" }],
      },
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
    });
  });
});
