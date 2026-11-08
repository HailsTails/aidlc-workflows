import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import type { DistributionLayout } from "../domain/payload.ts";
import type { PriorIntegrationShapes } from "../domain/release-history.ts";

export const codexLayoutFixture: DistributionLayout = {
  rootIntegrations: [
    {
      path: path(".gitignore"),
      policy: "managed-block",
      marker: "gitignore",
      sharing: "union",
      optional: false,
    },
    {
      path: path("AGENTS.md"),
      policy: "managed-block",
      marker: "agents",
      sharing: "identical",
      optional: false,
    },
  ],
  managedDirectories: [
    { path: path(".codex"), ownership: "shipped-files-only" },
    { path: path(".codex/aidlc-rules"), ownership: "whole-directory" },
    { path: path(".codex/tools"), ownership: "whole-directory" },
    { path: path(".agents/skills"), ownership: "shipped-files-only" },
  ],
};

export const codexPriorIntegrationsFixture: readonly PriorIntegrationShapes[] = [
  {
    integration: path("AGENTS.md"),
    wholeFileHashes: [
      hash("sha256:30a9f5f43d87cd29b63e75333b8ef6695f8f4e11909fd6af64e2b6cf0b8cb292"),
    ],
    entryHashes: {},
  },
];
