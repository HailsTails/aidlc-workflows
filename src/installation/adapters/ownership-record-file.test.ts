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

const opencodeRecord: OwnershipRecordFile = {
  ...claudeRecord,
  rootContributions: opencodeContributions,
};

const recordWithEntries: OwnershipRecordFile = {
  ...claudeRecord,
  entries: { ".claude/settings.json": { "hooks.UserPromptSubmit": SETTINGS_HASH } },
};

const READABLE_RECORDS = [
  { shape: "a Claude install record", record: claudeRecord },
  { shape: "every policy a root contribution can be recorded under", record: opencodeRecord },
  { shape: "per-file entry hashes", record: recordWithEntries },
];

const REFUSED_RECORDS = [
  {
    shape: "a record from another schema version",
    record: { ...claudeRecord, schemaVersion: 2 },
    issues: [{ code: "invalid_value", path: ["schemaVersion"] }],
  },
  {
    shape: "an MCP mode it does not know",
    record: { ...claudeRecord, mcpMode: "all" },
    issues: [{ code: "invalid_value", path: ["mcpMode"] }],
  },
  {
    shape: "a root contribution under a policy it does not know",
    record: {
      ...claudeRecord,
      rootContributions: { ".gitignore": { policy: "line-set", hash: BLOCK_HASH } },
    },
    issues: [{ code: "invalid_union", path: ["rootContributions", ".gitignore", "policy"] }],
  },
  {
    shape: "a json-array contribution without its key",
    record: {
      ...claudeRecord,
      rootContributions: {
        ".kiro/settings/mcp.json": { policy: "json-array", entries: { context7: SERVER_HASH } },
      },
    },
    issues: [
      { code: "invalid_type", path: ["rootContributions", ".kiro/settings/mcp.json", "key"] },
    ],
  },
];

describe("OwnershipRecordFileSchema", () => {
  test.each(READABLE_RECORDS)("reads $shape", ({ record }) => {
    expect(OwnershipRecordFileSchema.parse(record)).toEqual(record);
  });

  test.each(REFUSED_RECORDS)("refuses $shape", ({ record, issues }) => {
    expect(OwnershipRecordFileSchema.safeParse(record)).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});
