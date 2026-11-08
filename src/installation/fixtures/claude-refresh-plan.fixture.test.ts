import { describe, expect, test } from "bun:test";
import {
  claudeBlockedRefreshPlanFixture,
  claudeRefreshPlanFixture,
} from "./claude-refresh-plan.fixture.ts";

const PREVIOUS_AGENT_HASH =
  "sha256:631688bc85683ea22c9415cb345c69169cff4ac45ec006c258217cd261a7793f";
const EDITED_ONBOARDING_HASH =
  "sha256:3cc1cbd212d2ca0dbf1e525eb9a40d4694a585eb7864d8b877f8fe8bd99122dc";
const RETIRED_RUNNER_HASH =
  "sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b";
const GITIGNORE_BEFORE_HASH =
  "sha256:03e5a56e659249fcfddde50ede4a6d4719969a2f15ec384ec1d0cf23f0ca4651";
const GITIGNORE_AFTER_HASH =
  "sha256:d261eaecb9fa83dc3e3c3bd6ca70cc909197e6ad1fdf34cfbb24ce88cd62dd77";
const GITIGNORE_BLOCK_HASH =
  "sha256:84fcf62c2fd7a35c8e662a7d2f5318399fd5163a98bc0b283d4227b3b571f687";

const filesBesideStageCommand = [
  {
    kind: "update",
    file: { path: ".claude/agents/aidlc-developer-agent.md" },
    replaces: PREVIOUS_AGENT_HASH,
    change: "content",
  },
  {
    kind: "create",
    file: { path: ".claude/knowledge/aidlc-developer-agent/code-generation-guide.md" },
  },
  { kind: "unchanged", path: ".claude/settings.json" },
  { kind: "preserve", path: ".claude/CLAUDE.md", projectHash: EDITED_ONBOARDING_HASH },
  {
    kind: "retire",
    path: ".claude/skills/aidlc-legacy-runner/SKILL.md",
    expected: RETIRED_RUNNER_HASH,
  },
];

const refreshRootIntegrations = [
  {
    kind: "merge",
    integration: { path: ".gitignore", policy: "managed-block" },
    before: { kind: "hash", hash: GITIGNORE_BEFORE_HASH },
    next: {
      content: {
        kind: "text",
        text: "node_modules/\n# >>> aidlc gitignore\naidlc/**/.aidlc-*\n# <<< aidlc gitignore\n",
      },
      hash: GITIGNORE_AFTER_HASH,
    },
    contribution: {
      integration: ".gitignore",
      written: { kind: "block", marker: "gitignore", hash: GITIGNORE_BLOCK_HASH },
    },
  },
  { kind: "unchanged", integration: { path: ".mcp.json", policy: "json-map" } },
];

describe("claudeRefreshPlanFixture", () => {
  test("refreshes a 2.11.1 Claude install to the 2.12.0 copy payload", () => {
    expect(claudeRefreshPlanFixture).toMatchObject({
      kind: "ready",
      payload: { version: "2.12.0", channel: "copy" },
      mode: { kind: "refresh", edits: "refuse" },
      installedVersion: "2.11.1",
      mcp: "defaults",
      notes: [],
    });
  });

  test("decides every managed file kind, starting with the unchanged stage command", () => {
    expect(claudeRefreshPlanFixture.files).toMatchObject([
      { kind: "unchanged", path: ".claude/skills/aidlc-code-generation/SKILL.md" },
      ...filesBesideStageCommand,
    ]);
  });

  test("merges the gitignore block and leaves the MCP servers unchanged", () => {
    expect(claudeRefreshPlanFixture.rootIntegrations).toMatchObject(refreshRootIntegrations);
  });

  test("expects the ownership record it read before planning", () => {
    expect(claudeRefreshPlanFixture.recordBefore).toEqual<{ kind: "hash"; hash: string }>({
      kind: "hash",
      hash: "sha256:5b1f0e2b7d1c4f8a9e3d6c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a29",
    });
  });
});

describe("claudeBlockedRefreshPlanFixture", () => {
  test("blocks the same refresh because the person edited the stage command", () => {
    expect(claudeBlockedRefreshPlanFixture).toMatchObject({
      kind: "blocked",
      payload: { version: "2.12.0", channel: "copy" },
      mode: { kind: "refresh", edits: "refuse" },
      installedVersion: "2.11.1",
      mcp: "defaults",
      conflicts: [
        {
          path: ".claude/skills/aidlc-code-generation/SKILL.md",
          cause: {
            kind: "edited",
            recorded: "sha256:051866aa49f8ed915ab5ae30707422068df814ca5be806a1fe28784c543a4aab",
            current: "sha256:a618a3a615ef7159c7eed634a5a332bf9d017f8e28d6b0f0adad9db1d2d725e0",
            lifecycle: "live",
          },
        },
      ],
      notes: [],
    });
  });

  test("decides every other managed file as the ready plan does", () => {
    expect(claudeBlockedRefreshPlanFixture.files).toMatchObject(filesBesideStageCommand);
  });

  test("decides the root integrations as the ready plan does", () => {
    expect(claudeBlockedRefreshPlanFixture.rootIntegrations).toMatchObject(
      refreshRootIntegrations,
    );
  });
});
