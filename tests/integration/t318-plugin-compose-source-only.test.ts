import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readPluginDropText, runPluginCompose } from "../../dist/claude/.claude/tools/aidlc-plugin-test.ts";
import { buildPluginProjection, composePluginFixture, copyHarnessInstall } from "../harness/plugin-kit.ts";

const scratch = mkdtempSync(join(tmpdir(), "aidlc-t318-"));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function write(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, "utf-8");
}

function composeWithStaleInstalledContent(input: {
  readonly label: string;
  readonly installedPath: string;
}): {
  readonly projectDir: string;
  readonly firstStatus: number;
  readonly secondStatus: number;
  readonly firstDrops: string;
  readonly secondDrops: string;
} {
  const projectDir = join(scratch, `${input.label}-project`);
  const pluginBuilt = join(scratch, `${input.label}-plugin`);
  copyHarnessInstall("claude", projectDir);
  buildPluginProjection("test-pro", "claude", pluginBuilt);
  write(join(projectDir, ".claude", input.installedPath), "# stale\n");
  write(join(projectDir, "notes", "operator.md"), "# operator owned\n");
  const first = runPluginCompose({
    harness: "claude",
    harnessLeaf: ".claude",
    projectDir,
    pluginBuilt,
  });
  const firstDrops = readPluginDropText(projectDir);
  const second = runPluginCompose({
    harness: "claude",
    harnessLeaf: ".claude",
    projectDir,
    pluginBuilt,
  });
  return {
    projectDir,
    firstStatus: first.status,
    secondStatus: second.status,
    firstDrops,
    secondDrops: readPluginDropText(projectDir),
  };
}

describe("t318 installed plugin composition source classification", () => {
  test("compose excludes maintained source while installing runtime content", () => {
    const result = composePluginFixture({
      plugin: "test-pro",
      harness: "claude",
      projectDir: join(scratch, "source-only-project"),
      beforeCompose: ({ pluginBuilt }) => {
        write(join(pluginBuilt, "tools", "probe.spec.mts"), "export const sourceTest = true;\n");
        write(join(pluginBuilt, "tools", "test-fixtures", "input.json"), "{}\n");
        write(join(pluginBuilt, "knowledge", "test-fixtures", "example.md"), "# fixture\n");
        write(join(pluginBuilt, "agents", "test-fixtures", "example.md"), "# fixture\n");
        write(join(pluginBuilt, "scopes", "test-fixtures", "example.md"), "# fixture\n");
        write(join(pluginBuilt, "stages", "construction", "test-fixtures", "example.md"), "# fixture\n");
        write(join(pluginBuilt, "tools", "probe.ts"), "export const runtimeTool = true;\n");
      },
    });
    const installed = join(result.projectDir, ".claude");

    expect(result.composeStatus).toBe(0);
    expect(readFileSync(join(installed, "tools", "probe.ts"), "utf-8")).toBe("export const runtimeTool = true;\n");
    expect(existsSync(join(result.pluginBuilt, "hooks", "compose.ts"))).toBe(true);
    expect(existsSync(join(installed, "agents", "test-pro-metrics-agent.md"))).toBe(true);
    expect(existsSync(join(installed, "scopes", "test-pro-validation.md"))).toBe(true);
    expect(existsSync(join(installed, "aidlc-common", "stages", "construction", "test-pro-integration.md"))).toBe(true);
    expect(existsSync(join(installed, "tools", "probe.spec.mts"))).toBe(false);
    expect(existsSync(join(installed, "tools", "test-fixtures", "input.json"))).toBe(false);
    expect(existsSync(join(installed, "knowledge", "test-fixtures", "example.md"))).toBe(false);
    expect(existsSync(join(installed, "agents", "test-fixtures", "example.md"))).toBe(false);
    expect(existsSync(join(installed, "scopes", "test-fixtures", "example.md"))).toBe(false);
    expect(existsSync(join(installed, "aidlc-common", "stages", "construction", "test-fixtures", "example.md"))).toBe(false);
  });

  test("stale installed tool fixture stays owned by the operator with a persistent advisory", () => {
    const projectDir = join(scratch, "stale-tools-project");
    const pluginBuilt = join(scratch, "stale-tools-plugin");
    copyHarnessInstall("claude", projectDir);
    buildPluginProjection("test-pro", "claude", pluginBuilt);
    write(join(pluginBuilt, "tools", "probe.ts"), "export const runtimeTool = true;\n");
    write(join(projectDir, ".claude", "tools", "test-fixtures", "stale.json"), "{}\n");
    write(join(projectDir, ".claude", "tools", "operator-owned.ts"), "export const operatorOwned = true;\n");
    write(join(projectDir, "notes", "operator.md"), "# operator owned\n");

    const first = runPluginCompose({
      harness: "claude",
      harnessLeaf: ".claude",
      projectDir,
      pluginBuilt,
    });
    const firstDrops = readPluginDropText(projectDir);
    const second = runPluginCompose({
      harness: "claude",
      harnessLeaf: ".claude",
      projectDir,
      pluginBuilt,
    });
    const secondDrops = readPluginDropText(projectDir);

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(firstDrops).toContain("[advisory]");
    expect(firstDrops).toContain('installed tool file "test-fixtures/stale.json"');
    expect(secondDrops).toContain('installed tool file "test-fixtures/stale.json"');
    expect(existsSync(join(projectDir, ".claude", "tools", "probe.ts"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "tools", "test-pro-doctor.ts"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "agents", "test-pro-metrics-agent.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "scopes", "test-pro-validation.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "aidlc-common", "stages", "construction", "test-pro-integration.md"))).toBe(true);
    expect(readFileSync(join(projectDir, ".claude", "tools", "test-fixtures", "stale.json"), "utf-8")).toBe("{}\n");
    expect(readFileSync(join(projectDir, ".claude", "tools", "operator-owned.ts"), "utf-8")).toBe("export const operatorOwned = true;\n");
    expect(readFileSync(join(projectDir, "notes", "operator.md"), "utf-8")).toBe("# operator owned\n");
  });

  test("stale installed knowledge fixture independently keeps a persistent advisory", () => {
    const projectDir = join(scratch, "stale-knowledge-project");
    const pluginBuilt = join(scratch, "stale-knowledge-plugin");
    copyHarnessInstall("claude", projectDir);
    buildPluginProjection("test-pro", "claude", pluginBuilt);
    write(join(pluginBuilt, "tools", "probe.ts"), "export const runtimeTool = true;\n");
    write(join(projectDir, ".claude", "knowledge", "test-fixtures", "stale.md"), "# stale\n");
    write(join(projectDir, "notes", "operator.md"), "# operator owned\n");

    const first = runPluginCompose({
      harness: "claude",
      harnessLeaf: ".claude",
      projectDir,
      pluginBuilt,
    });
    const firstDrops = readPluginDropText(projectDir);
    const second = runPluginCompose({
      harness: "claude",
      harnessLeaf: ".claude",
      projectDir,
      pluginBuilt,
    });
    const secondDrops = readPluginDropText(projectDir);

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(firstDrops).toContain("[advisory]");
    expect(firstDrops).toContain("test-fixtures/stale.md");
    expect(secondDrops).toContain("test-fixtures/stale.md");
    expect(existsSync(join(projectDir, ".claude", "tools", "probe.ts"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "tools", "test-pro-doctor.ts"))).toBe(true);
    expect(readFileSync(join(projectDir, ".claude", "knowledge", "test-fixtures", "stale.md"), "utf-8")).toBe("# stale\n");
    expect(readFileSync(join(projectDir, "notes", "operator.md"), "utf-8")).toBe("# operator owned\n");
  });

  test("stale installed agent fixture keeps a persistent advisory without clobber", () => {
    const result = composeWithStaleInstalledContent({
      label: "stale-agents",
      installedPath: "agents/test-fixtures/stale.md",
    });

    expect(result.firstStatus).toBe(0);
    expect(result.secondStatus).toBe(0);
    expect(existsSync(join(result.projectDir, ".claude", "agents", "test-pro-metrics-agent.md"))).toBe(true);
    expect(readFileSync(join(result.projectDir, ".claude", "agents", "test-fixtures", "stale.md"), "utf-8")).toBe("# stale\n");
    expect(readFileSync(join(result.projectDir, "notes", "operator.md"), "utf-8")).toBe("# operator owned\n");
    expect(result.firstDrops).toContain("[advisory]");
    expect(result.firstDrops).toContain('installed agent file "test-fixtures/stale.md"');
    expect(result.secondDrops).toContain('installed agent file "test-fixtures/stale.md"');
  });

  test("stale installed scope fixture keeps a persistent advisory without clobber", () => {
    const result = composeWithStaleInstalledContent({
      label: "stale-scopes",
      installedPath: "scopes/test-fixtures/stale.md",
    });

    expect(result.firstStatus).toBe(0);
    expect(result.secondStatus).toBe(0);
    expect(existsSync(join(result.projectDir, ".claude", "scopes", "test-pro-validation.md"))).toBe(true);
    expect(readFileSync(join(result.projectDir, ".claude", "scopes", "test-fixtures", "stale.md"), "utf-8")).toBe("# stale\n");
    expect(readFileSync(join(result.projectDir, "notes", "operator.md"), "utf-8")).toBe("# operator owned\n");
    expect(result.firstDrops).toContain("[advisory]");
    expect(result.firstDrops).toContain('installed scope file "test-fixtures/stale.md"');
    expect(result.secondDrops).toContain('installed scope file "test-fixtures/stale.md"');
  });

  test("stale installed sensor fixture keeps a persistent advisory without clobber", () => {
    const result = composeWithStaleInstalledContent({
      label: "stale-sensors",
      installedPath: "sensors/test-fixtures/stale.md",
    });

    expect(result.firstStatus).toBe(0);
    expect(result.secondStatus).toBe(0);
    expect(existsSync(join(result.projectDir, ".claude", "sensors", "aidlc-coverage-threshold.md"))).toBe(true);
    expect(readFileSync(join(result.projectDir, ".claude", "sensors", "test-fixtures", "stale.md"), "utf-8")).toBe("# stale\n");
    expect(readFileSync(join(result.projectDir, "notes", "operator.md"), "utf-8")).toBe("# operator owned\n");
    expect(result.firstDrops).toContain("[advisory]");
    expect(result.firstDrops).toContain('installed sensor file "test-fixtures/stale.md"');
    expect(result.secondDrops).toContain('installed sensor file "test-fixtures/stale.md"');
  });

  test("stale installed stage fixture keeps a persistent advisory without clobber", () => {
    const result = composeWithStaleInstalledContent({
      label: "stale-stages",
      installedPath: "aidlc-common/stages/construction/test-fixtures/stale.md",
    });

    expect(result.firstStatus).toBe(0);
    expect(result.secondStatus).toBe(0);
    expect(existsSync(join(result.projectDir, ".claude", "aidlc-common", "stages", "construction", "test-pro-integration.md"))).toBe(true);
    expect(readFileSync(join(result.projectDir, ".claude", "aidlc-common", "stages", "construction", "test-fixtures", "stale.md"), "utf-8")).toBe("# stale\n");
    expect(readFileSync(join(result.projectDir, "notes", "operator.md"), "utf-8")).toBe("# operator owned\n");
    expect(result.firstDrops).toContain("[advisory]");
    expect(result.firstDrops).toContain('installed stage file "construction/test-fixtures/stale.md"');
    expect(result.secondDrops).toContain('installed stage file "construction/test-fixtures/stale.md"');
  });
});
