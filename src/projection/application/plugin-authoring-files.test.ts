import { expect, test } from "bun:test";
import { distribution, host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { pluginAuthoringFiles, shippedPluginTarget } from "./plugin-authoring-files.ts";

const claude = { host: host({ name: "claude", directory: ".claude" }), target: {
  format: "store", manifestDir: ".claude-plugin", marketplaceDir: ".claude-plugin",
  catalogue: "written" as const, installRoots: [".claude", ".gitignore", ".mcp.json", "aidlc"],
} };

test("plugin targets retain the shipped field order, indentation and final newline", () => {
  const files = pluginAuthoringFiles({ method: methodSliceFixture, targets: [claude], templates: [], directory: path(".claude") });
  expect(files[0]).toEqual({ path: path(".claude/tools/data/plugin-targets.json"), mode: "regular",
    origin: { kind: "runtime-data", name: "plugin-targets" }, content: { kind: "text", text: `{
  "claude": {
    "harnessName": "claude",
    "manifestDir": ".claude-plugin",
    "marketplaceDir": ".claude-plugin",
    "hostCatalogue": true,
    "harnessLeaf": ".claude",
    "kind": "store",
    "installRoots": [
      ".claude",
      ".gitignore",
      ".mcp.json",
      "aidlc"
    ]
  }
}
` } });
  expect(files[1]?.content).toEqual({ kind: "text", text: `{
  "agents": [
    "aidlc-architect-agent",
    "aidlc-architecture-reviewer-agent",
    "aidlc-delivery-agent",
    "aidlc-developer-agent",
    "aidlc-product-agent",
    "aidlc-product-lead-agent"
  ],
  "stages": [
    "code-generation",
    "requirements-analysis",
    "units-generation"
  ]
}
` });
});

test.each(["store", "kiro", "kiro-ide", "cursor"])("the %s target preserves declared fields", (format) => {
  expect(shippedPluginTarget({ ...claude, target: { ...claude.target, format, catalogue: "none" } }))
    .toEqual({ harnessName: distribution("claude"), manifestDir: ".claude-plugin", marketplaceDir: ".claude-plugin",
      hostCatalogue: false, harnessLeaf: path(".claude"), kind: format,
      installRoots: [".claude", ".gitignore", ".mcp.json", "aidlc"] });
});

test("nested templates retain their exact byte content and source origin", () => {
  const content = { kind: "bytes" as const, bytes: new Uint8Array([0, 255, 13, 10]) };
  const files = pluginAuthoringFiles({ method: methodSliceFixture, targets: [], directory: path(".claude"),
    templates: [{ path: source("nested/hook.ts"), content }] });
  expect(files[2]).toEqual({ path: path(".claude/tools/data/plugin-hooks-template/nested/hook.ts"),
    content, mode: "regular", origin: { kind: "neutral", source: source("scripts/plugin-hooks-template/nested/hook.ts") } });
  expect(files[2]?.content).toBe(content);
});
