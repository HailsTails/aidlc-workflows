import { describe, expect, test } from "bun:test";
import { OverlayFileSchema, PluginManifestFileSchema } from "./plugin-files.ts";

const TEST_PRO_MANIFEST = `{
  "name": "test-pro", "version": "0.1.1",
  "description": "Full-featured testing plugin with comprehensive, traceable test coverage.",
  "author": { "name": "AWS AIDLC" }, "dependencies": ["core"],
  "aidlc": {
    "rulesLevel": "team",
    "contributes": {
      "stages": "stages/", "overlays": "contributions/", "agents": "agents/",
      "scopes": "scopes/", "knowledge": "knowledge/", "sensors": "sensors/",
      "tools": "tools/", "memory": "memory/"
    }
  }
}`;

const COMMAND_MANIFEST_FIELDS = `
  "name": "coverage-kit", "version": "1.0.0", "description": "Coverage helpers",
  "aidlc": {
    "marketplace": "acme-tools", "contributes": { "tools": "tools/" },
    "commands": {
      "coverage-report": {
        "script": "tools/coverage-report.ts", "description": "Print the coverage report"
      }
    }
  }`;

const COMMAND_MANIFEST = `{${COMMAND_MANIFEST_FIELDS} }`;

const COMMAND_MANIFEST_AS_READ = `{${COMMAND_MANIFEST_FIELDS}, "dependencies": ["core"] }`;

const READABLE_MANIFESTS = [
  {
    shape: "the test-pro manifest, keeping keys AI-DLC does not read",
    text: TEST_PRO_MANIFEST,
    read: TEST_PRO_MANIFEST,
  },
  {
    shape: "a manifest with commands, depending on core when it names no dependencies",
    text: COMMAND_MANIFEST,
    read: COMMAND_MANIFEST_AS_READ,
  },
];

const REFUSED_MANIFESTS = [
  {
    shape: "a misspelt key in the aidlc block",
    text: `{
      "name": "test-pro", "version": "0.1.1", "description": "Testing",
      "aidlc": { "rulesLevl": "team", "contributes": {} }
    }`,
    issues: [{ code: "unrecognized_keys", keys: ["rulesLevl"], path: ["aidlc"] }],
  },
  {
    shape: "a contribution folder other than its canonical one",
    text: `{
      "name": "test-pro", "version": "0.1.1", "description": "Testing",
      "aidlc": { "contributes": { "stages": "stage/" } }
    }`,
    issues: [{ code: "invalid_value", path: ["aidlc", "contributes", "stages"] }],
  },
  {
    shape: "a command script outside the tools folder",
    text: `{
      "name": "coverage-kit", "version": "1.0.0", "description": "Coverage helpers",
      "aidlc": {
        "contributes": { "tools": "tools/" },
        "commands": { "report": { "script": "scripts/report.ts", "description": "Report" } }
      }
    }`,
    issues: [{ code: "invalid_format", path: ["aidlc", "commands", "report", "script"] }],
  },
  {
    shape: "a rules level it does not know",
    text: `{
      "name": "test-pro", "version": "0.1.1", "description": "Testing",
      "aidlc": { "rulesLevel": "org-wide", "contributes": {} }
    }`,
    issues: [{ code: "invalid_value", path: ["aidlc", "rulesLevel"] }],
  },
];

const STAGE_OVERLAY = `{
  "target": "build-and-test", "plugin": "test-pro",
  "adds": {
    "produces": ["test-pro-regression-suite"], "required_sections": ["Branch Coverage", "Edges"],
    "consumes": [{ "artifact": "test-pro-testability-requirements", "required": false }],
    "sensors": ["coverage-threshold", "requirement-coverage"], "requires_stage": ["nfr-design"]
  },
  "fragments": [
    { "anchor": "after-step:8", "order": 100 },
    { "anchor": "after-step:9", "order": 130 },
    { "anchor": "in:Sensors", "order": 150 }
  ]
}`;

const AGENT_OVERLAY = `{
  "target": "aidlc-quality-agent", "plugin": "test-pro",
  "fragments": [
    { "anchor": "after-preflight", "order": 90 },
    { "anchor": "in:Collaboration", "order": 100 }
  ]
}`;

const READABLE_OVERLAYS = [
  { shape: "a stage overlay with additions and step fragments", text: STAGE_OVERLAY },
  { shape: "an agent overlay with persona fragments", text: AGENT_OVERLAY },
];

const REFUSED_OVERLAYS = [
  {
    shape: "a misspelt key among the additions",
    text: `{
      "target": "build-and-test", "plugin": "test-pro", "fragments": [],
      "adds": { "requires_stages": ["nfr-design"] }
    }`,
    issues: [{ code: "unrecognized_keys", keys: ["requires_stages"], path: ["adds"] }],
  },
  {
    shape: "an anchor it does not know",
    text: `{
      "target": "aidlc-quality-agent", "plugin": "test-pro",
      "fragments": [{ "anchor": "after:8", "order": 100 }]
    }`,
    issues: [{ code: "invalid_format", path: ["fragments", 0, "anchor"] }],
  },
  {
    shape: "a fragment with a fractional order",
    text: `{
      "target": "aidlc-quality-agent", "plugin": "test-pro",
      "fragments": [{ "anchor": "end-of-body", "order": 1.5 }]
    }`,
    issues: [{ code: "invalid_type", path: ["fragments", 0, "order"] }],
  },
];

describe("PluginManifestFileSchema", () => {
  test.each(READABLE_MANIFESTS)("reads $shape", ({ text, read }) => {
    expect(PluginManifestFileSchema.parse(JSON.parse(text))).toEqual(JSON.parse(read));
  });

  test.each(REFUSED_MANIFESTS)("refuses $shape", ({ text, issues }) => {
    expect(PluginManifestFileSchema.safeParse(JSON.parse(text))).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});

describe("OverlayFileSchema", () => {
  test.each(READABLE_OVERLAYS)("reads $shape", ({ text }) => {
    expect(OverlayFileSchema.parse(JSON.parse(text))).toEqual(JSON.parse(text));
  });

  test.each(REFUSED_OVERLAYS)("refuses $shape", ({ text, issues }) => {
    expect(OverlayFileSchema.safeParse(JSON.parse(text))).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});
