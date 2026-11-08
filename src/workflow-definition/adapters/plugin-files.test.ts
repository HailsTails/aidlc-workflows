import { describe, expect, test } from "bun:test";
import {
  OverlayFileSchema,
  PluginManifestFileSchema,
  type OverlayFile,
  type PluginManifestFile,
} from "./plugin-files.ts";

const testProManifest: PluginManifestFile = {
  name: "test-pro",
  version: "0.1.1",
  description: "Full-featured testing plugin with comprehensive, traceable test coverage.",
  author: { name: "AWS AIDLC" },
  dependencies: ["core"],
  aidlc: {
    rulesLevel: "team",
    contributes: {
      stages: "stages/",
      overlays: "contributions/",
      agents: "agents/",
      scopes: "scopes/",
      knowledge: "knowledge/",
      sensors: "sensors/",
      tools: "tools/",
      memory: "memory/",
    },
  },
};

const commandManifest = {
  name: "coverage-kit",
  version: "1.0.0",
  description: "Coverage helpers",
  aidlc: {
    marketplace: "acme-tools",
    contributes: { tools: "tools/" },
    commands: {
      "coverage-report": {
        script: "tools/coverage-report.ts",
        description: "Print the coverage report",
      },
    },
  },
};

const stageOverlay: OverlayFile = {
  target: "build-and-test",
  plugin: "test-pro",
  adds: {
    produces: ["test-pro-branch-coverage-instructions", "test-pro-regression-suite"],
    consumes: [{ artifact: "test-pro-testability-requirements", required: false }],
    requires_stage: ["nfr-design"],
    sensors: ["coverage-threshold", "requirement-coverage"],
    required_sections: ["Branch Coverage", "Edge Cases"],
  },
  fragments: [
    { anchor: "after-step:8", order: 100 },
    { anchor: "after-step:9", order: 130 },
    { anchor: "in:Sensors", order: 150 },
  ],
};

const agentOverlay: OverlayFile = {
  target: "aidlc-quality-agent",
  plugin: "test-pro",
  fragments: [
    { anchor: "after-preflight", order: 90 },
    { anchor: "in:Collaboration", order: 100 },
  ],
};

describe("PluginManifestFileSchema", () => {
  test("reads the test-pro manifest, keeping keys AI-DLC does not read", () => {
    expect(PluginManifestFileSchema.parse(testProManifest)).toEqual(testProManifest);
  });

  test("reads a manifest with a marketplace and commands", () => {
    expect(PluginManifestFileSchema.parse(commandManifest)).toMatchObject(commandManifest);
  });

  test("depends on core when the manifest names no dependencies", () => {
    expect(PluginManifestFileSchema.parse(commandManifest).dependencies).toEqual(["core"]);
  });

  test("refuses a misspelt key in the aidlc block", () => {
    const manifest = {
      ...testProManifest,
      aidlc: { ...testProManifest.aidlc, rulesLevl: "team" },
    };
    expect(PluginManifestFileSchema.safeParse(manifest)).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["rulesLevl"], path: ["aidlc"] }] },
    });
  });

  test("refuses a contribution folder other than its canonical one", () => {
    const manifest = {
      ...testProManifest,
      aidlc: { contributes: { stages: "stage/" } },
    };
    expect(PluginManifestFileSchema.safeParse(manifest)).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["aidlc", "contributes", "stages"] }] },
    });
  });

  test("refuses a command script outside the tools folder", () => {
    const manifest = {
      ...commandManifest,
      aidlc: {
        contributes: { tools: "tools/" },
        commands: { report: { script: "scripts/report.ts", description: "Report" } },
      },
    };
    expect(PluginManifestFileSchema.safeParse(manifest)).toMatchObject({
      success: false,
      error: {
        issues: [{ code: "invalid_format", path: ["aidlc", "commands", "report", "script"] }],
      },
    });
  });

  test("refuses a rules level it does not know", () => {
    const manifest = {
      ...testProManifest,
      aidlc: { ...testProManifest.aidlc, rulesLevel: "org-wide" },
    };
    expect(PluginManifestFileSchema.safeParse(manifest)).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["aidlc", "rulesLevel"] }] },
    });
  });
});

describe("OverlayFileSchema", () => {
  test("reads a stage overlay with additions and step fragments", () => {
    expect(OverlayFileSchema.parse(stageOverlay)).toEqual(stageOverlay);
  });

  test("reads an agent overlay with persona fragments", () => {
    expect(OverlayFileSchema.parse(agentOverlay)).toEqual(agentOverlay);
  });

  test("refuses a misspelt key among the additions", () => {
    const overlay = { ...stageOverlay, adds: { requires_stages: ["nfr-design"] } };
    expect(OverlayFileSchema.safeParse(overlay)).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["requires_stages"], path: ["adds"] }] },
    });
  });

  test("refuses an anchor it does not know", () => {
    const overlay = { ...agentOverlay, fragments: [{ anchor: "after:8", order: 100 }] };
    expect(OverlayFileSchema.safeParse(overlay)).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["fragments", 0, "anchor"] }] },
    });
  });

  test("refuses a fragment with a fractional order", () => {
    const overlay = { ...agentOverlay, fragments: [{ anchor: "end-of-body", order: 1.5 }] };
    expect(OverlayFileSchema.safeParse(overlay)).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_type", path: ["fragments", 0, "order"] }] },
    });
  });
});
