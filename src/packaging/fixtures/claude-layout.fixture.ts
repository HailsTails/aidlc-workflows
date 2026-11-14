import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import type { DistributionLayout } from "../domain/payload.ts";
import type { PriorIntegrationShapes } from "../domain/release-history.ts";

export const claudeLayoutFixture: DistributionLayout = {
  rootIntegrations: [
    {
      path: path(".gitignore"),
      policy: "managed-block",
      marker: "gitignore",
      sharing: "union",
      presence: "required",
    },
    {
      path: path(".mcp.json"),
      policy: "json-map",
      key: "mcpServers",
      presence: "optional",
    },
  ],
  managedDirectories: [
    { path: path(".claude"), ownership: "shipped-files-only" },
    { path: path(".claude/aidlc-common"), ownership: "whole-directory" },
    { path: path(".claude/knowledge"), ownership: "whole-directory" },
    { path: path(".claude/tools"), ownership: "whole-directory" },
  ],
};

export const claudePriorIntegrationsFixture: readonly PriorIntegrationShapes[] = [
  {
    integration: path(".gitignore"),
    wholeFileHashes: [
      hash("sha256:3da36b2d01551aeae2e366caa08be8cce0dbc9110e252445dcaa4e758e24a0b6"),
      hash("sha256:4f1cd2e930bd37d2f5d715a06ea3fa1e2d39479fc662f0f0562116376132114b"),
    ],
    entryHashes: {},
  },
  {
    integration: path(".mcp.json"),
    wholeFileHashes: [],
    entryHashes: {
      context7: [
        hash("sha256:8a440d21705f35c8f5649f118d17f786e08d589fb2dd888f5de5aa503233afbf"),
      ],
    },
  },
];
