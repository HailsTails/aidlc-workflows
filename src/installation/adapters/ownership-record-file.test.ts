import { describe, expect, test } from "bun:test";
import { OwnershipRecordFileSchema, type OwnershipRecordFile } from "./ownership-record-file.ts";

const AGENT_HASH = "sha256:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326";
const SETTINGS_HASH = "sha256:0bc504601ad6e02566b12be53fe175d421ab786f086dc320cef1251e5ad43bc8";
const BLOCK_HASH = "sha256:84fcf62c2fd7a35c8e662a7d2f5318399fd5163a98bc0b283d4227b3b571f687";
const SERVER_HASH = "sha256:8a440d21705f35c8f5649f118d17f786e08d589fb2dd888f5de5aa503233afbf";

const claudeRecord: OwnershipRecordFile = {
  schemaVersion: 1,
  frameworkVersion: "2.11.1",
  distribution: "claude",
  harnessDir: ".claude",
  mcpMode: "defaults",
  files: {
    ".claude/agents/aidlc-developer-agent.md": AGENT_HASH,
    ".claude/settings.json": SETTINGS_HASH,
  },
  shippedOnly: true,
  rootContributions: {
    ".gitignore": { policy: "managed-block", hash: BLOCK_HASH, marker: "gitignore" },
    ".mcp.json": { policy: "json-map", entries: { context7: SERVER_HASH }, key: "mcpServers" },
  },
  statusLineKept: true,
};

const opencodeContributions: OwnershipRecordFile["rootContributions"] = {
  "AGENTS.md": { policy: "whole-file", hash: BLOCK_HASH },
  "opencode.json": { policy: "json-entries", entries: { "mcp.context7": SERVER_HASH } },
  ".vscode/settings.json": {
    policy: "jsonc-settings",
    entries: { "files.exclude": SETTINGS_HASH },
    added: ["files.exclude"],
    created: false,
  },
  ".kiro/settings/mcp.json": {
    policy: "json-array",
    entries: { context7: SERVER_HASH },
    key: "servers",
  },
};

describe("OwnershipRecordFileSchema", () => {
  test("reads a Claude install record", () => {
    expect(OwnershipRecordFileSchema.parse(claudeRecord)).toEqual(claudeRecord);
  });

  test("reads every policy a root contribution can be recorded under", () => {
    const record: OwnershipRecordFile = {
      ...claudeRecord,
      rootContributions: opencodeContributions,
    };
    expect(OwnershipRecordFileSchema.parse(record)).toEqual(record);
  });

  test("reads per-file entry hashes", () => {
    const record: OwnershipRecordFile = {
      ...claudeRecord,
      entries: { ".claude/settings.json": { "hooks.UserPromptSubmit": SETTINGS_HASH } },
    };
    expect(OwnershipRecordFileSchema.parse(record)).toEqual(record);
  });

  test("refuses a record from another schema version", () => {
    expect(
      OwnershipRecordFileSchema.safeParse({ ...claudeRecord, schemaVersion: 2 }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["schemaVersion"] }] },
    });
  });

  test("refuses an MCP mode it does not know", () => {
    expect(OwnershipRecordFileSchema.safeParse({ ...claudeRecord, mcpMode: "all" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["mcpMode"] }] },
    });
  });

  test("refuses a root contribution under a policy it does not know", () => {
    const record = {
      ...claudeRecord,
      rootContributions: { ".gitignore": { policy: "line-set", hash: BLOCK_HASH } },
    };
    expect(OwnershipRecordFileSchema.safeParse(record)).toMatchObject({
      success: false,
      error: {
        issues: [{ code: "invalid_union", path: ["rootContributions", ".gitignore", "policy"] }],
      },
    });
  });

  test("refuses a json-array contribution without its key", () => {
    const record = {
      ...claudeRecord,
      rootContributions: {
        ".kiro/settings/mcp.json": { policy: "json-array", entries: { context7: SERVER_HASH } },
      },
    };
    expect(OwnershipRecordFileSchema.safeParse(record)).toMatchObject({
      success: false,
      error: {
        issues: [
          { code: "invalid_type", path: ["rootContributions", ".kiro/settings/mcp.json", "key"] },
        ],
      },
    });
  });
});
