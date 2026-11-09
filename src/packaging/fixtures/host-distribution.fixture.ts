import { path } from "../../kernel/fixtures/values.fixture.ts";
import type { HostDistribution } from "../domain/payload.ts";
import { claudeLayoutFixture, claudePriorIntegrationsFixture } from "./claude-layout.fixture.ts";

export const claudeHostDistributionFixture: HostDistribution = {
  layout: claudeLayoutFixture,
  priorIntegrations: claudePriorIntegrationsFixture,
  listing: {},
  native: { replacements: [], copyOnly: [] },
  plugin: {
    format: "store",
    manifestDir: ".claude-plugin",
    marketplaceDir: ".claude-plugin",
    catalogue: "written",
    installRoots: [".claude", ".mcp.json", "aidlc"],
  },
};

export const kiroIdeHostDistributionFixture: HostDistribution = {
  layout: {
    rootIntegrations: [],
    managedDirectories: [{ path: path(".kiro"), ownership: "shipped-files-only" }],
  },
  priorIntegrations: [],
  listing: {
    choiceNote: "Kiro IDE, and Kiro CLI on its agent system",
    firstRunSteps: ["Open this folder in Kiro."],
    editorTerminalApp: "kiro",
    cliFirst: {
      env: ["KIRO_CLI"],
      configNextStep: "start kiro-cli in this project and run /aidlc",
      firstRunSteps: ["Run kiro-cli in this folder."],
    },
  },
  native: {
    replacements: [{ from: "bun .kiro/tools/aidlc.ts", to: "aidlc" }],
    copyOnly: [],
  },
  plugin: {
    format: "kiro-ide",
    manifestDir: ".kiro-plugin",
    marketplaceDir: ".kiro-plugin",
    catalogue: "none",
    installRoots: [".kiro", "AGENTS.md", "aidlc"],
  },
};

export const cursorNativeReleaseFixture: HostDistribution["native"] = {
  replacements: [],
  copyOnly: [path("install.ts")],
};

export const scratchHostDistributionFixture: HostDistribution = {
  layout: {
    rootIntegrations: [],
    managedDirectories: [{ path: path(".scratch"), ownership: "shipped-files-only" }],
  },
  priorIntegrations: [],
  listing: {},
  native: { replacements: [], copyOnly: [] },
  plugin: {
    format: "store",
    manifestDir: ".scratch-plugin",
    marketplaceDir: ".scratch-plugin",
    catalogue: "written",
    installRoots: [".scratch", "aidlc"],
  },
};
