import { describe, expect, test } from "bun:test";
import {
  DistributionDescriptorFileSchema,
  type DistributionDescriptorFile,
} from "./distribution-descriptor-file.ts";

const GITIGNORE_HASH = "sha256:3da36b2d01551aeae2e366caa08be8cce0dbc9110e252445dcaa4e758e24a0b6";
const SERVER_HASH = "sha256:8a440d21705f35c8f5649f118d17f786e08d589fb2dd888f5de5aa503233afbf";
const RUNNER_HASH = "sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b";

const claudeDescriptor: DistributionDescriptorFile = {
  schemaVersion: 2,
  frameworkVersion: "2.12.0",
  layout: "copy",
  distribution: "claude",
  harnessDir: ".claude",
  rootIntegrations: [
    {
      path: ".gitignore",
      policy: "managed-block",
      marker: "gitignore",
      shared: "union",
      legacySignatures: { wholeFileHashes: [GITIGNORE_HASH] },
    },
    {
      path: ".mcp.json",
      policy: "json-map",
      jsonKey: "mcpServers",
      optional: true,
      legacySignatures: { jsonEntryHashes: { context7: [SERVER_HASH] } },
    },
  ],
  managedDirectories: [
    { path: ".claude", ownership: "shipped-files-only" },
    { path: ".claude/aidlc-common", ownership: "whole-directory" },
  ],
  retiredFiles: { ".claude/skills/aidlc-legacy-runner/SKILL.md": [RUNNER_HASH] },
};

const otherPolicies: DistributionDescriptorFile["rootIntegrations"] = [
  { path: "AGENTS.md", policy: "whole-file", shared: "identical" },
  { path: ".kiro/settings/mcp.json", policy: "json-array", jsonKey: "servers" },
  { path: ".vscode/settings.json", policy: "jsonc-settings" },
  { path: "opencode.json", policy: "json-entries", optional: true },
];

describe("DistributionDescriptorFileSchema", () => {
  test("reads a Claude copy-channel descriptor", () => {
    expect(DistributionDescriptorFileSchema.parse(claudeDescriptor)).toEqual(claudeDescriptor);
  });

  test("reads every other root integration policy", () => {
    const descriptor: DistributionDescriptorFile = {
      ...claudeDescriptor,
      layout: "native",
      rootIntegrations: otherPolicies,
    };
    expect(DistributionDescriptorFileSchema.parse(descriptor)).toEqual(descriptor);
  });

  test("refuses a key the descriptor does not define", () => {
    expect(
      DistributionDescriptorFileSchema.safeParse({ ...claudeDescriptor, productName: "Claude" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["productName"], path: [] }] },
    });
  });

  test("refuses a misspelt key on a root integration", () => {
    const descriptor = {
      ...claudeDescriptor,
      rootIntegrations: [{ path: "AGENTS.md", policy: "whole-file", shard: "identical" }],
    };
    expect(DistributionDescriptorFileSchema.safeParse(descriptor)).toMatchObject({
      success: false,
      error: {
        issues: [{ code: "unrecognized_keys", keys: ["shard"], path: ["rootIntegrations", 0] }],
      },
    });
  });

  test("refuses a sharing mode on a policy that cannot share", () => {
    const descriptor = {
      ...claudeDescriptor,
      rootIntegrations: [{ path: "opencode.json", policy: "json-entries", shared: "union" }],
    };
    expect(DistributionDescriptorFileSchema.safeParse(descriptor)).toMatchObject({
      success: false,
      error: {
        issues: [{ code: "unrecognized_keys", keys: ["shared"], path: ["rootIntegrations", 0] }],
      },
    });
  });

  test("refuses a misspelt key in the legacy signatures", () => {
    const descriptor = {
      ...claudeDescriptor,
      rootIntegrations: [
        {
          path: "AGENTS.md",
          policy: "whole-file",
          legacySignatures: { wholeFileHash: [GITIGNORE_HASH] },
        },
      ],
    };
    expect(DistributionDescriptorFileSchema.safeParse(descriptor)).toMatchObject({
      success: false,
      error: {
        issues: [
          {
            code: "unrecognized_keys",
            keys: ["wholeFileHash"],
            path: ["rootIntegrations", 0, "legacySignatures"],
          },
        ],
      },
    });
  });

  test("refuses the schema version a 2.11 release wrote", () => {
    expect(
      DistributionDescriptorFileSchema.safeParse({ ...claudeDescriptor, schemaVersion: 1 }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["schemaVersion"] }] },
    });
  });

  test("refuses a channel it does not know", () => {
    expect(
      DistributionDescriptorFileSchema.safeParse({ ...claudeDescriptor, layout: "plugin" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["layout"] }] },
    });
  });

  test("refuses a retired file hash without its algorithm", () => {
    const descriptor = { ...claudeDescriptor, retiredFiles: { "AGENTS.md": ["1d51ae4c"] } };
    expect(DistributionDescriptorFileSchema.safeParse(descriptor)).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["retiredFiles", "AGENTS.md", 0] }] },
    });
  });

  test("refuses a distribution name that is not kebab case", () => {
    expect(
      DistributionDescriptorFileSchema.safeParse({ ...claudeDescriptor, distribution: "Claude" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["distribution"] }] },
    });
  });
});
