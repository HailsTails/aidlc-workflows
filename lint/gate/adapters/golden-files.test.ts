import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { goldenDrift } from "../domain/golden.ts";
import { goldenSource, type GoldenLayout } from "./golden-files.ts";

const SANDBOX = join(import.meta.dir, "../../../.cache/gate-tests", randomUUID());
const PLUGIN_AGENT = "dist/plugins/test-pro/claude/agents/test-pro-metrics-agent.md";
const MARKETPLACE = "dist/plugins/.claude-plugin/marketplace.json";

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

const layoutIn = (name: string): GoldenLayout => ({
  root: join(SANDBOX, name),
  outputRoots: ["dist", "dist-release"],
  harnesses: () => ["claude", "codex"],
  storeDirectory: "tests/golden",
});

const place = (request: {
  readonly layout: GoldenLayout;
  readonly path: string;
  readonly content: string;
}): void => {
  const absolute = join(request.layout.root, request.path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, request.content);
};

const builtPluginTree = (name: string): GoldenLayout => {
  const layout = layoutIn(name);
  place({ layout, path: PLUGIN_AGENT, content: "metrics agent\n" });
  place({ layout, path: "dist/plugins/test-pro/codex/agents/metrics.md", content: "codex\n" });
  place({ layout, path: MARKETPLACE, content: "{}\n" });
  return layout;
};

describe("plugin output goldens", () => {
  test("a generated plugin file is recorded under its harness, not the marketplace group", () => {
    const measured = goldenSource(builtPluginTree("grouping")).measure();
    expect(Object.keys(measured["claude"] ?? {})).toEqual([PLUGIN_AGENT]);
    expect(Object.keys(measured["plugin-marketplaces"] ?? {})).toEqual([MARKETPLACE]);
  });

  test("red probe: one changed byte in a generated plugin file is drift in that harness", () => {
    const layout = builtPluginTree("changed-byte");
    const recorded = goldenSource(layout).measure();
    place({ layout, path: PLUGIN_AGENT, content: "metrics agent!\n" });
    const drift = goldenDrift({ expected: recorded, actual: goldenSource(layout).measure() });
    expect(drift).toEqual([{ group: "claude", path: PLUGIN_AGENT, change: "changed" }]);
  });

  test("red probe: an added generated plugin file is drift", () => {
    const layout = builtPluginTree("added-file");
    const recorded = goldenSource(layout).measure();
    const added = "dist/plugins/test-pro/codex/agents/extra.md";
    place({ layout, path: added, content: "extra\n" });
    const drift = goldenDrift({ expected: recorded, actual: goldenSource(layout).measure() });
    expect(drift).toEqual([{ group: "codex", path: added, change: "added" }]);
  });

  test("red probe: a changed marketplace file is drift in its own group", () => {
    const layout = builtPluginTree("marketplace");
    const recorded = goldenSource(layout).measure();
    place({ layout, path: MARKETPLACE, content: '{"plugins":[]}\n' });
    const drift = goldenDrift({ expected: recorded, actual: goldenSource(layout).measure() });
    expect(drift).toEqual([
      { group: "plugin-marketplaces", path: MARKETPLACE, change: "changed" },
    ]);
  });
});
