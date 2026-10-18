// covers: file:core/tools/aidlc-plugin-build.ts, file:core/tools/aidlc-plugin-emit.ts,
// function:runWithOwnerStampedLock

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPluginProjection,
  pluginBuildLockPath,
  readPluginTargets,
} from "../../dist/claude/.claude/tools/aidlc-plugin-emit.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_TOOLS = join(
  REPO_ROOT,
  "dist",
  "claude",
  ".claude",
  "tools",
);
const SOURCE_PLUGIN = join(REPO_ROOT, "plugins", "test-pro");
const EXPECTED_ROOT = join(REPO_ROOT, "dist", "plugins", "test-pro");
const HARNESSES = readdirSync(EXPECTED_ROOT)
  .filter((name) => statSync(join(EXPECTED_ROOT, name)).isDirectory())
  .sort();
const EXPECTED_HARNESSES = [
  "claude",
  "codex",
  "copilot",
  "cursor",
  "kiro",
  "kiro-ide",
  "opencode",
];
const scratch = mkdtempSync(join(tmpdir(), "aidlc-t315-"));
const copiedTools = join(scratch, "runtime", "tools");
const buildTool = join(copiedTools, "aidlc-plugin-build.ts");
const PROJECTION_MARKER = ".aidlc-plugin-projection.json";

cpSync(SOURCE_TOOLS, copiedTools, { recursive: true });

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[]): Run {
  const result = spawnSync(process.execPath, [buildTool, ...args], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    cwd: scratch,
    encoding: "utf-8",
  });
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
  };
}

function copyPlugin(label: string): string {
  const root = join(scratch, label, "test-pro");
  mkdirSync(dirname(root), { recursive: true });
  cpSync(SOURCE_PLUGIN, root, { recursive: true });
  return root;
}

function minimalPlugin(name: string): string {
  const root = join(scratch, "minimal-plugins", name);
  mkdirSync(join(root, ".aidlc-plugin"), { recursive: true });
  writeFileSync(
    join(root, ".aidlc-plugin", "plugin.json"),
    `${JSON.stringify(
      {
        name,
        version: "1.0.0",
        description: "Minimal plugin",
        author: { name: "Fixture" },
        dependencies: ["core"],
        aidlc: { contributes: { tools: "tools/" } },
      },
      null,
      2,
    )}\n`,
    { encoding: "utf-8", flag: "w" },
  );
  mkdirSync(join(root, "tools"), { recursive: true });
  writeFileSync(
    join(root, "tools", `${name}-tool.ts`),
    'console.log("fixture");\n',
    "utf-8",
  );
  return root;
}

function treeFiles(root: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        out.set(relative(root, path).replaceAll("\\", "/"), readFileSync(path));
      }
    }
  };
  walk(root);
  return out;
}

function treeDiff(expected: string, actual: string): string[] {
  const expectedFiles = treeFiles(expected);
  const actualFiles = treeFiles(actual);
  const names = new Set([...expectedFiles.keys(), ...actualFiles.keys()]);
  const differences: string[] = [];
  for (const name of [...names].sort()) {
    const left = expectedFiles.get(name);
    const right = actualFiles.get(name);
    if (!left) differences.push(`EXTRA ${name}`);
    else if (!right) differences.push(`MISSING ${name}`);
    else if (!left.equals(right)) differences.push(`DIFFERS ${name}`);
  }
  return differences;
}

describe("t315 standalone plugin builder", () => {
  test("native hook declarations require the repository packager before any output is created", () => {
    const pluginRoot = minimalPlugin("native-hooks");
    const manifestPath = join(pluginRoot, ".aidlc-plugin", "plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.aidlc.hooks = { claude: [{ event: "PreToolUse", matcher: "Bash", target: "native-hooks-guard", hookFile: "native-hooks-guard.mjs", capabilityId: "native-hooks-guard" }] };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    mkdirSync(join(pluginRoot, "hooks"));
    writeFileSync(join(pluginRoot, "hooks", "native-hooks-guard.mjs"), "process.exit(0);\n");
    const output = join(scratch, "native-hook-cli-output");
    const result = run([pluginRoot, "claude", output, "--json"]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("repository packager");
    expect(existsSync(output)).toBe(false);
  });

  test("repository package writer keeps maintained source out of repeated runtime builds", () => {
    const checkout = join(scratch, "package-writer-checkout");
    cpSync(join(REPO_ROOT, "core"), join(checkout, "core"), { recursive: true });
    cpSync(join(REPO_ROOT, "harness"), join(checkout, "harness"), { recursive: true });
    cpSync(join(REPO_ROOT, "scripts"), join(checkout, "scripts"), { recursive: true });
    cpSync(SOURCE_PLUGIN, join(checkout, "plugins", "test-pro"), { recursive: true });
    symlinkSync(join(REPO_ROOT, "node_modules"), join(checkout, "node_modules"), "dir");
    const pluginRoot = join(checkout, "plugins", "test-pro");
    const toolTest = join(pluginRoot, "tools", "probe.test.ts");
    const toolSpec = join(pluginRoot, "tools", "probe.spec.ts");
    const testFixture = join(pluginRoot, "tools", "test-fixtures", "input.json");
    const knowledgeSpec = join(pluginRoot, "knowledge", "probe.spec.ts");
    const runtimeTool = join(pluginRoot, "tools", "probe.ts");
    writeFileSync(toolTest, "export const toolTestSentinel = true;\n");
    writeFileSync(toolSpec, "export const toolSpecSentinel = true;\n");
    mkdirSync(dirname(testFixture), { recursive: true });
    writeFileSync(testFixture, "{\"fixture\":true}\n");
    writeFileSync(knowledgeSpec, "export const knowledgeSpecSentinel = true;\n");
    writeFileSync(runtimeTool, "export const runtimeToolSentinel = true;\n");
    const sourceSnapshot = join(scratch, "package-writer-source-snapshot");
    cpSync(pluginRoot, sourceSnapshot, { recursive: true });
    const packageScript = join(checkout, "scripts", "package.ts");
    const firstOutput = join(scratch, "package-writer-first-output");
    const secondOutput = join(scratch, "package-writer-second-output");

    const first = spawnSync(process.execPath, [packageScript, "plugin", "build", "test-pro", "claude", firstOutput], {
      cwd: checkout,
      encoding: "utf-8",
    });
    const second = spawnSync(process.execPath, [packageScript, "plugin", "build", "test-pro", "claude", secondOutput], {
      cwd: checkout,
      encoding: "utf-8",
    });

    expect(first.status, first.stderr).toBe(0);
    expect(second.status, second.stderr).toBe(0);
    expect(treeDiff(firstOutput, secondOutput)).toEqual([]);
    expect(existsSync(join(firstOutput, "tools", "probe.test.ts"))).toBe(false);
    expect(existsSync(join(firstOutput, "tools", "probe.spec.ts"))).toBe(false);
    expect(existsSync(join(firstOutput, "tools", "test-fixtures", "input.json"))).toBe(false);
    expect(existsSync(join(firstOutput, "knowledge", "probe.spec.ts"))).toBe(false);
    expect(readFileSync(join(firstOutput, "tools", "probe.ts"), "utf-8")).toBe("export const runtimeToolSentinel = true;\n");
    expect(existsSync(join(firstOutput, "hooks", "compose.ts"))).toBe(true);
    expect(existsSync(join(firstOutput, "agents", "test-pro-metrics-agent.md"))).toBe(true);
    expect(existsSync(join(firstOutput, "stages", "construction", "test-pro-integration.md"))).toBe(true);
    expect(existsSync(join(firstOutput, "scopes", "test-pro-validation.md"))).toBe(true);
    expect(treeDiff(sourceSnapshot, pluginRoot)).toEqual([]);
  });

  test("maintained tests stay in source and out of every runtime projection", () => {
    const pluginRoot = copyPlugin("source-only-content");
    const toolsRoot = join(pluginRoot, "tools");
    mkdirSync(join(toolsRoot, "test-fixtures"), { recursive: true });
    writeFileSync(join(toolsRoot, "probe.test.ts"), "export const testSentinel = true;\n");
    writeFileSync(join(toolsRoot, "probe.spec.ts"), "export const specSentinel = true;\n");
    writeFileSync(join(toolsRoot, "test-fixtures", "input.json"), "{}\n");
    writeFileSync(join(toolsRoot, "probe.ts"), "export const runtimeSentinel = true;\n");

    for (const harness of HARNESSES) {
      const outDir = join(scratch, "source-only-outputs", harness);
      const result = run([pluginRoot, harness, outDir, "--json"]);
      expect(result.status, `${harness}: ${result.stderr}`).toBe(0);
      expect(existsSync(join(outDir, "tools", "probe.ts"))).toBe(true);
      expect(existsSync(join(outDir, "tools", "probe.test.ts"))).toBe(false);
      expect(existsSync(join(outDir, "tools", "probe.spec.ts"))).toBe(false);
      expect(existsSync(join(outDir, "tools", "test-fixtures", "input.json"))).toBe(false);
    }

    expect(existsSync(join(toolsRoot, "probe.test.ts"))).toBe(true);
    expect(existsSync(join(toolsRoot, "probe.spec.ts"))).toBe(true);
    expect(existsSync(join(toolsRoot, "test-fixtures", "input.json"))).toBe(true);
  });

  test("copied tools place the same test-pro files for every harness", () => {
    expect(HARNESSES).toEqual(EXPECTED_HARNESSES);
    const pluginRoot = copyPlugin("all-harnesses");
    for (const harness of HARNESSES) {
      const outDir = join(scratch, "outputs", harness);
      const result = run([pluginRoot, harness, outDir, "--json"]);
      expect(result.status, `${harness}: ${result.stderr}`).toBe(0);
      const json = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(Object.keys(json)).toEqual(["valid", "errors", "warnings"]);
      expect(json.valid).toBe(true);
      const packagedTree = treeFiles(join(EXPECTED_ROOT, harness));
      const placedTree = treeFiles(outDir);
      const packagedFiles = [...packagedTree.keys()]
        .filter((file) => harness !== "codex" || !file.endsWith(".toml"))
        .sort();
      expect([...placedTree.keys()].sort(), harness).toEqual(packagedFiles);
      const harnessDir = readPluginTargets(
        join(SOURCE_TOOLS, "data", "plugin-targets.json"),
      )[harness]?.harnessLeaf;
      expect(harnessDir).toBeDefined();
      const rulesLeaf = ({ codex: "aidlc-rules", kiro: "steering", "kiro-ide": "steering" } as Record<string, string>)[harness] ?? "rules";
      const changedContent = [...placedTree].flatMap(([file, content]) => {
        const projectedMarkdown = content.toString("utf-8")
          .replaceAll("{{HARNESS_DIR}}/rules/", `${harnessDir}/${rulesLeaf}/`)
          .replaceAll("{{HARNESS_DIR}}", harnessDir ?? "");
        const projected = file.endsWith(".md")
          ? Buffer.from(projectedMarkdown)
          : content;
        return projected.equals(packagedTree.get(file) ?? Buffer.alloc(0))
          ? []
          : [file];
      });
      expect(changedContent, harness).toEqual([]);
    }
  });

  test("Codex standalone builder emits a root-relative supported marketplace beside its native plugin manifest", () => {
    const pluginRoot = copyPlugin("supported-codex-marketplace");
    const outDir = join(scratch, "supported-codex-marketplace-output");
    const result = run([pluginRoot, "codex", outDir, "--json"]);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(outDir, ".codex-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(outDir, ".agents", "plugins", "marketplace.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(outDir, ".agents", "plugins", "marketplace.json"), "utf-8"))).toEqual(
      expect.objectContaining({
        name: "aidlc-plugins",
        plugins: [expect.objectContaining({ name: "aidlc-test-pro", source: "." })],
      }),
    );
  });

  test("Claude standalone builder preserves its existing marketplace layout", () => {
    const pluginRoot = copyPlugin("preserved-claude-marketplace");
    const outDir = join(scratch, "preserved-claude-marketplace-output");
    const result = run([pluginRoot, "claude", outDir, "--json"]);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(outDir, ".claude-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(outDir, ".claude-plugin", "marketplace.json"))).toBe(true);
    expect(existsSync(join(outDir, ".agents", "plugins", "marketplace.json"))).toBe(false);
  });

  test("Codex standalone builder places Markdown without packager-native TOML", () => {
    const pluginRoot = copyPlugin("generic-codex-placement");
    const outDir = join(scratch, "generic-codex-placement-output");
    const result = run([pluginRoot, "codex", outDir, "--json"]);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const sourceAgents = readdirSync(join(pluginRoot, "agents"))
      .filter((file) => file.endsWith("-agent.md"))
      .sort();
    const placedAgents = readdirSync(join(outDir, "agents"))
      .filter((file) => file.endsWith("-agent.md"))
      .sort();
    const nativeAgents = readdirSync(join(outDir, "agents"))
      .filter((file) => file.endsWith(".toml"));
    expect(placedAgents).toEqual(sourceAgents);
    expect(nativeAgents).toEqual([]);
  });

  test("authored Codex TOML cannot overwrite a generated native agent", () => {
    const pluginRoot = copyPlugin("colliding-codex-agent");
    writeFileSync(
      join(pluginRoot, "agents", "test-pro-metrics-agent.toml"),
      'name = "colliding-agent"\n',
      "utf8",
    );
    const result = run([pluginRoot, "codex", join(scratch, "colliding-codex-output"), "--json"]);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as {
      errors: Array<{ message: string }>;
    };
    expect(parsed.errors[0]?.message).toContain("authored Codex TOML collides");
  });

  test("default output is <plugin-root>/dist/<harness>", () => {
    const pluginRoot = copyPlugin("default-output");
    const result = run([pluginRoot, "claude", "--json"]);
    expect(result.status, result.stderr).toBe(0);
    const explicitOutput = join(scratch, "default-explicit-output");
    expect(run([pluginRoot, "claude", explicitOutput, "--json"]).status).toBe(0);
    expect(treeDiff(explicitOutput, join(pluginRoot, "dist", "claude"))).toEqual([]);
  });

  test("the same plugin and harness can rebuild its owned projection", () => {
    const pluginRoot = copyPlugin("same-owner-rebuild");
    const outDir = join(scratch, "same-owner-output");
    expect(run([pluginRoot, "claude", outDir, "--json"]).status).toBe(0);
    const marker = JSON.parse(
      readFileSync(join(outDir, PROJECTION_MARKER), "utf-8"),
    ) as Record<string, unknown>;
    expect(marker).toEqual({
      schema: 1,
      producer: "aidlc-plugin-build",
      plugin: "test-pro",
      harness: "claude",
    });
    writeFileSync(join(outDir, "stale-sentinel.txt"), "stale\n", "utf-8");

    const rebuilt = run([pluginRoot, "claude", outDir, "--json"]);
    expect(rebuilt.status, rebuilt.stderr).toBe(0);
    expect(existsSync(join(outDir, "stale-sentinel.txt"))).toBe(false);
  });

  test("a different plugin cannot replace another plugin's projection", () => {
    const owner = copyPlugin("different-plugin-owner");
    const other = minimalPlugin("other-plugin");
    const outDir = join(scratch, "different-plugin-output");
    expect(run([owner, "claude", outDir, "--json"]).status).toBe(0);
    const manifestPath = join(outDir, ".claude-plugin", "plugin.json");
    const originalManifest = readFileSync(manifestPath, "utf-8");
    writeFileSync(join(outDir, "sentinel.txt"), "preserve\n", "utf-8");

    const refused = run([other, "claude", outDir, "--json"]);
    expect(refused.status).toBe(1);
    const parsed = JSON.parse(refused.stdout) as {
      errors: Array<{ rule: string; message: string }>;
    };
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({
        rule: "build-output",
        message: expect.stringContaining(
          'belongs to plugin "test-pro" for harness "claude"',
        ),
      }),
    );
    expect(readFileSync(join(outDir, "sentinel.txt"), "utf-8")).toBe(
      "preserve\n",
    );
    expect(readFileSync(manifestPath, "utf-8")).toBe(originalManifest);
  });

  test("shared Kiro output shapes remain bound to the exact harness", () => {
    const pluginRoot = copyPlugin("kiro-owner");
    const outDir = join(scratch, "kiro-owned-output");
    expect(run([pluginRoot, "kiro", outDir, "--json"]).status).toBe(0);
    writeFileSync(join(outDir, "sentinel.txt"), "preserve\n", "utf-8");

    const refused = run([pluginRoot, "kiro-ide", outDir, "--json"]);
    expect(refused.status).toBe(1);
    const parsed = JSON.parse(refused.stdout) as {
      errors: Array<{ message: string }>;
    };
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'belongs to plugin "test-pro" for harness "kiro"',
        ),
      }),
    );
    expect(existsSync(join(outDir, "sentinel.txt"))).toBe(true);
  });

  test("missing and malformed ownership markers refuse rebuilds without mutation", () => {
    const pluginRoot = copyPlugin("invalid-marker-owner");
    for (const [label, markerBody] of [
      ["missing", null],
      ["malformed", "{not-json}\n"],
    ] as const) {
      const outDir = join(scratch, `invalid-marker-${label}`);
      expect(run([pluginRoot, "claude", outDir, "--json"]).status).toBe(0);
      const markerPath = join(outDir, PROJECTION_MARKER);
      if (markerBody === null) rmSync(markerPath);
      else writeFileSync(markerPath, markerBody, "utf-8");
      writeFileSync(join(outDir, "sentinel.txt"), "preserve\n", "utf-8");

      const refused = run([pluginRoot, "claude", outDir, "--json"]);
      expect(refused.status).toBe(1);
      const parsed = JSON.parse(refused.stdout) as {
        errors: Array<{ rule: string; message: string }>;
      };
      expect(parsed.errors).toContainEqual(
        expect.objectContaining({
          rule: "build-output",
          message: expect.stringContaining("no valid"),
        }),
      );
      expect(existsSync(join(outDir, "sentinel.txt"))).toBe(true);
    }
  });

  test("direct emission reclaims an abandoned unstamped output lock", () => {
    const pluginRoot = copyPlugin("contended-output-lock");
    const outDir = join(scratch, "contended-output");
    const lockDir = pluginBuildLockPath(outDir);
    mkdirSync(lockDir, { recursive: true });
    const target = readPluginTargets(
      join(SOURCE_TOOLS, "data", "plugin-targets.json"),
    ).claude;
    buildPluginProjection({
      pluginRoot,
      target,
      outDir,
      templateHooksDir: join(SOURCE_TOOLS, "data", "plugin-hooks-template"),
      lockTimeoutMs: 25,
    });
    expect(existsSync(outDir)).toBe(true);
    expect(existsSync(lockDir)).toBe(false);
  });

  test("direct emission reclaims a dead owner-stamped output lock", () => {
    const pluginRoot = copyPlugin("dead-output-lock");
    const outDir = join(scratch, "dead-owner-output");
    const lockDir = pluginBuildLockPath(outDir);
    const token = randomUUID();
    mkdirSync(join(lockDir, token), { recursive: true });
    writeFileSync(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: 2_000_000_000,
        startedAtMs: Math.floor(
          performance.timeOrigin + performance.now(),
        ),
        reapLiveOwnerAfterStale: true,
        token,
      }),
      "utf-8",
    );
    const target = readPluginTargets(
      join(SOURCE_TOOLS, "data", "plugin-targets.json"),
    ).claude;

    buildPluginProjection({
      pluginRoot,
      target,
      outDir,
      templateHooksDir: join(
        SOURCE_TOOLS,
        "data",
        "plugin-hooks-template",
      ),
      lockTimeoutMs: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    });

    expect(existsSync(outDir)).toBe(true);
    expect(existsSync(lockDir)).toBe(false);
  });

  test("direct emission does not reclaim a live owner-stamped output lock", () => {
    const pluginRoot = copyPlugin("live-output-lock");
    const outDir = join(scratch, "live-owner-output");
    const lockDir = pluginBuildLockPath(outDir);
    const token = randomUUID();
    mkdirSync(join(lockDir, token), { recursive: true });
    writeFileSync(
      join(lockDir, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        startedAtMs: Math.floor(
          performance.timeOrigin + performance.now(),
        ),
        reapLiveOwnerAfterStale: true,
        token,
      }),
      "utf-8",
    );
    const target = readPluginTargets(
      join(SOURCE_TOOLS, "data", "plugin-targets.json"),
    ).claude;
    try {
      expect(() =>
        buildPluginProjection({
          pluginRoot,
          target,
          outDir,
          templateHooksDir: join(
            SOURCE_TOOLS,
            "data",
            "plugin-hooks-template",
          ),
          lockTimeoutMs: 25,
        })
      ).toThrow("could not acquire plugin build output lock");
      expect(existsSync(lockDir)).toBe(true);
      expect(existsSync(outDir)).toBe(false);
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  test("direct emission reclaims only an aged unstamped output lock", () => {
    const pluginRoot = copyPlugin("aged-unstamped-output-lock");
    const outDir = join(scratch, "aged-unstamped-output");
    const lockDir = pluginBuildLockPath(outDir);
    mkdirSync(lockDir, { recursive: true });
    utimesSync(lockDir, new Date(0), new Date(0));
    const target = readPluginTargets(
      join(SOURCE_TOOLS, "data", "plugin-targets.json"),
    ).claude;
    const previousGrace = process.env.AIDLC_LOCK_UNSTAMPED_GRACE_MS;
    process.env.AIDLC_LOCK_UNSTAMPED_GRACE_MS = "1";
    try {
      buildPluginProjection({
        pluginRoot,
        target,
        outDir,
        templateHooksDir: join(
          SOURCE_TOOLS,
          "data",
          "plugin-hooks-template",
        ),
        lockTimeoutMs: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
      });
      expect(existsSync(outDir)).toBe(true);
      expect(existsSync(lockDir)).toBe(false);
    } finally {
      if (previousGrace === undefined) {
        delete process.env.AIDLC_LOCK_UNSTAMPED_GRACE_MS;
      } else {
        process.env.AIDLC_LOCK_UNSTAMPED_GRACE_MS = previousGrace;
      }
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  test("custom output under a symlinked environmental ancestor remains valid", () => {
    const pluginRoot = copyPlugin("symlinked-environment-custom");
    const realEnvironment = join(scratch, "real-environment");
    const linkedEnvironment = join(scratch, "linked-environment");
    mkdirSync(realEnvironment, { recursive: true });
    symlinkSync(
      realEnvironment,
      linkedEnvironment,
      process.platform === "win32" ? "junction" : "dir",
    );
    const outDir = join(linkedEnvironment, "owned-output");

    const result = run([pluginRoot, "claude", outDir, "--json"]);
    expect(result.status, result.stderr).toBe(0);
    const directOutput = join(scratch, "symlinked-environment-direct");
    expect(run([pluginRoot, "claude", directOutput, "--json"]).status).toBe(0);
    expect(treeDiff(directOutput, outDir)).toEqual([]);
  });

  test("authored compose hook cannot occupy the reserved bootstrap path", () => {
    const pluginRoot = copyPlugin("vendored-hook");
    const vendored = join(pluginRoot, "hooks", "compose.ts");
    mkdirSync(dirname(vendored), { recursive: true });
    writeFileSync(
      vendored,
      readFileSync(
        join(
          copiedTools,
          "data",
          "plugin-hooks-template",
          "compose.ts",
        ),
      ),
    );
    const outDir = join(scratch, "vendored-output");
    const result = run([pluginRoot, "claude", outDir, "--json"]);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as {
      errors: Array<{ message: string }>;
    };
    expect(parsed.errors[0]?.message).toContain("collides with the compose bootstrap");
  });

  test("validation errors refuse the build with exit 1", () => {
    const pluginRoot = copyPlugin("invalid-plugin");
    rmSync(join(pluginRoot, ".aidlc-plugin", "plugin.json"));
    const outDir = join(scratch, "invalid-output");
    const result = run([pluginRoot, "claude", outDir, "--json"]);
    expect(result.status).toBe(1);
    const json = JSON.parse(result.stdout) as {
      valid: boolean;
      errors: Array<{ rule: string }>;
    };
    expect(json.valid).toBe(false);
    expect(json.errors.map((finding) => finding.rule)).toContain(
      "manifest-missing",
    );
    expect(existsSync(outDir)).toBe(false);
  });

  test("non-canonical contribution paths refuse BUILD before output creation", () => {
    const pluginRoot = copyPlugin("custom-contribution-path");
    renameSync(join(pluginRoot, "stages"), join(pluginRoot, "custom-stages"));
    const manifestPath = join(pluginRoot, ".aidlc-plugin", "plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      aidlc: { contributes: Record<string, string> };
    };
    manifest.aidlc.contributes.stages = "custom-stages/";
    writeFileSync(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf-8",
    );
    const outDir = join(scratch, "custom-contribution-output");

    const result = run([pluginRoot, "claude", outDir, "--json"]);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as {
      errors: Array<{ rule: string; message: string }>;
    };
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({
        rule: "manifest-shape",
        message: expect.stringContaining(
          'aidlc.contributes.stages must be "stages/"',
        ),
      }),
    );
    expect(existsSync(outDir)).toBe(false);
  });

  test("direct emission rejects absolute contribution paths before output creation", () => {
    const pluginRoot = copyPlugin("absolute-contribution-path");
    const manifestPath = join(pluginRoot, ".aidlc-plugin", "plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      aidlc: { contributes: Record<string, string> };
    };
    manifest.aidlc.contributes.stages = join(
      scratch,
      "outside-plugin-stages",
    );
    writeFileSync(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf-8",
    );
    const outDir = join(scratch, "absolute-contribution-output");
    const target = readPluginTargets(
      join(SOURCE_TOOLS, "data", "plugin-targets.json"),
    ).claude;

    expect(() =>
      buildPluginProjection({
        pluginRoot,
        target,
        outDir,
        templateHooksDir: join(
          SOURCE_TOOLS,
          "data",
          "plugin-hooks-template",
        ),
      })
    ).toThrow('aidlc.contributes.stages must be "stages/"');
    expect(existsSync(outDir)).toBe(false);
  });

  test("default output refuses a symlinked dist parent without touching its target", () => {
    const pluginRoot = copyPlugin("symlinked-default-parent");
    const linkedTarget = join(scratch, "symlinked-dist-target");
    mkdirSync(linkedTarget, { recursive: true });
    writeFileSync(join(linkedTarget, "sentinel.txt"), "unchanged\n", "utf-8");
    const distLink = join(pluginRoot, "dist");
    symlinkSync(
      linkedTarget,
      distLink,
      process.platform === "win32" ? "junction" : "dir",
    );

    const result = run([pluginRoot, "claude", "--json"]);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as {
      errors: Array<{ rule: string; message: string }>;
    };
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({
        rule: "build-output",
        message: expect.stringContaining(
          `parent path component "${distLink}" is a symlink`,
        ),
      }),
    );
    expect(readdirSync(linkedTarget)).toEqual(["sentinel.txt"]);
    expect(readFileSync(join(linkedTarget, "sentinel.txt"), "utf-8")).toBe(
      "unchanged\n",
    );
  });

  test("linked authored content refuses the build before output creation", () => {
    const pluginRoot = copyPlugin("symlinked-content");
    const linkedSource = join(scratch, "linked-plugin-tool.ts");
    writeFileSync(linkedSource, 'console.log("linked");\n', "utf-8");
    const linkedTool = join(pluginRoot, "tools", "linked-plugin-tool.ts");
    symlinkSync(linkedSource, linkedTool, "file");
    const outDir = join(scratch, "symlinked-content-output");

    const result = run([pluginRoot, "claude", outDir, "--json"]);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as {
      errors: Array<{ file: string; rule: string }>;
    };
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({
        file: "tools/linked-plugin-tool.ts",
        rule: "content-symlink",
      }),
    );
    expect(existsSync(outDir)).toBe(false);
  });

  test("usage and unknown harness errors exit 2", () => {
    expect(run([]).status).toBe(2);
    const pluginRoot = copyPlugin("unknown-harness");
    const unknown = run([pluginRoot, "unknown"]);
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toContain("Unknown harness");
  });
});
