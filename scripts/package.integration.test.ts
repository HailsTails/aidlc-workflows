import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("native Rin projection rewrites engine invocations while copy projection retains authored commands", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "aidlc-native-plugin-"));
  try {
    ["core", "harness", "plugins", "scripts", "node_modules"].forEach((directory) => {
      cpSync(join(projectRoot, directory), join(fixtureRoot, directory), { recursive: true, dereference: true });
    });
    ["package.json", "bun.lock", "tsconfig.json", "harness.config.json"].forEach((file) => {
      cpSync(join(projectRoot, file), join(fixtureRoot, file));
    });
    mkdirSync(join(fixtureRoot, "home"));
    const generated = spawnSync(process.execPath, ["scripts/package.ts", "claude"], {
      cwd: fixtureRoot, encoding: "utf-8", timeout: 180000,
      env: { PATH: dirname(process.execPath), HOME: join(fixtureRoot, "home"), TMPDIR: fixtureRoot },
    });
    expect({ status: generated.status, stderr: generated.stderr }).toEqual({ status: 0, stderr: "" });
    const copyRoot = join(fixtureRoot, "dist", "plugins", "rin", "claude");
    const nativeRoot = join(fixtureRoot, "dist-release", "plugins", "rin", "claude");
    expect(readFileSync(join(copyRoot, "scopes", "rin-unit.md"), "utf-8"))
      .toContain('bun .claude/tools/aidlc-utility.ts intent-create --scope rin-unit');
    expect(readFileSync(join(nativeRoot, "scopes", "rin-unit.md"), "utf-8"))
      .toContain('aidlc engine intent create --scope rin-unit');
    expect(readFileSync(join(nativeRoot, "stages", "inception", "rin-gate-3-interface-lock.md"), "utf-8"))
      .toContain('aidlc engine orchestrate next --stage rin-gate-2-plan-review');
    expect(readFileSync(join(nativeRoot, "stages", "construction", "rin-gate-5-review-cycle.md"), "utf-8"))
      .toContain('aidlc engine orchestrate park');
    expect(readFileSync(join(nativeRoot, "knowledge", "rin-gates", "README.md"), "utf-8"))
      .toContain('aidlc engine graph compile');
    expect(readFileSync(join(nativeRoot, "knowledge", "rin-gates", "README.md"), "utf-8"))
      .toContain('aidlc engine orchestrate report --result approved');
    expect(readFileSync(join(nativeRoot, "hooks", "provision-worktree.mjs"), "utf-8"))
      .toContain('"aidlc engine runtime compile"');
    expect(readFileSync(join(nativeRoot, "contributions", "hook-registrations.json"), "utf-8"))
      .not.toContain('bun .claude/tools/aidlc.ts');
    const sensorSource = join(fixtureRoot, "plugins", "rin", "sensors", "aidlc-framing-only.md");
    writeFileSync(sensorSource, readFileSync(sensorSource, "utf-8")
      .replace("aidlc-sensor-framing-only.ts", "aidlc-sensor-does-not-exist.ts"));
    const refused = spawnSync(process.execPath, ["scripts/package.ts", "claude"], {
      cwd: fixtureRoot, encoding: "utf-8", timeout: 180000,
      env: { PATH: dirname(process.execPath), HOME: join(fixtureRoot, "home"), TMPDIR: fixtureRoot },
    });
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('unresolvable projected namespace invocation "aidlc engine sensor-does-not-exist"');
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}, 360000);
