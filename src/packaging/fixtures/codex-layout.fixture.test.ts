import { describe, expect, test } from "bun:test";
import { codexLayoutFixture, codexPriorIntegrationsFixture } from "./codex-layout.fixture.ts";

describe("codexLayoutFixture", () => {
  test("integrates the gitignore block and an AGENTS.md block other harnesses share", () => {
    expect(codexLayoutFixture.rootIntegrations).toMatchObject([
      {
        path: ".gitignore",
        policy: "managed-block",
        marker: "gitignore",
        sharing: "union",
        presence: "required",
      },
      {
        path: "AGENTS.md",
        policy: "managed-block",
        marker: "agents",
        sharing: "identical",
        presence: "required",
      },
    ]);
  });

  test("owns folders under both .codex and the shared .agents skills folder", () => {
    expect(codexLayoutFixture.managedDirectories).toMatchObject([
      { path: ".codex", ownership: "shipped-files-only" },
      { path: ".codex/aidlc-rules", ownership: "whole-directory" },
      { path: ".codex/tools", ownership: "whole-directory" },
      { path: ".agents/skills", ownership: "shipped-files-only" },
    ]);
  });
});

describe("codexPriorIntegrationsFixture", () => {
  test("remembers an earlier whole AGENTS.md", () => {
    expect(codexPriorIntegrationsFixture).toMatchObject([
      {
        integration: "AGENTS.md",
        wholeFileHashes: [
          "sha256:30a9f5f43d87cd29b63e75333b8ef6695f8f4e11909fd6af64e2b6cf0b8cb292",
        ],
        entryHashes: {},
      },
    ]);
  });
});
