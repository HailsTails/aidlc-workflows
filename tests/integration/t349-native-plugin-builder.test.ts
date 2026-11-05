// covers: file:scripts/package.ts, file:core/tools/aidlc-plugin-build.ts
import { afterAll, expect, test, setDefaultTimeout } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
const repo = resolve(import.meta.dir, "../..");
const scratch = mkdtempSync(join(tmpdir(), "aidlc-native-plugin-builder-"));
const plugin = join(scratch, "authored input", "test-pro");
cpSync(join(repo, "plugins/test-pro"), plugin, { recursive: true });
// A real INVOKE consumer catches valid-but-wrong `aidlc engine engine` rewrites
// that the test-pro HARNESS_DIR-only descriptors cannot expose.
cpSync(join(repo, "core/sensors/aidlc-linter.md"), join(plugin, "sensors/aidlc-linter.md"));
afterAll(() => { rmSync(scratch, { recursive: true, force: true }); });

const cases = [
  { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", command: "command: bun .claude/tools/aidlc.ts engine sensor-linter" },
  { harness: "codex", directory: ".codex", invocation: "bun .codex/tools/aidlc.ts", command: "command: bun .codex/tools/aidlc.ts engine sensor-linter" },
  { harness: "copilot", directory: ".aidlc", invocation: "bun .aidlc/tools/aidlc.ts", command: "command: bun .aidlc/tools/aidlc.ts engine sensor-linter" },
  { harness: "cursor", directory: ".cursor", invocation: "bun .cursor/tools/aidlc.ts", command: "command: bun .cursor/tools/aidlc.ts engine sensor-linter" },
  { harness: "kiro", directory: ".kiro", invocation: "bun .kiro/tools/aidlc.ts", command: "command: bun .kiro/tools/aidlc.ts engine sensor-linter" },
  { harness: "kiro-ide", directory: ".kiro", invocation: "bun .kiro/tools/aidlc.ts", command: "command: bun .kiro/tools/aidlc.ts engine sensor-linter" },
  { harness: "opencode", directory: ".aidlc", invocation: "bun .aidlc/tools/aidlc.ts", command: "command: bun .aidlc/tools/aidlc.ts engine sensor-linter" },
];

for (const bundle of cases) {
  test(`${bundle.harness} copy and native bundles carry parseable source-builder contexts`, () => {
    for (const channel of ["dist", "dist-release"]) {
      const table = JSON.parse(readFileSync(join(repo, channel, bundle.harness, bundle.directory, "tools/data/plugin-targets.json"), "utf8"));
      expect(Object.keys(table).sort()).toEqual(["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"]);
      for (const target of cases) {
        expect(table[target.harness].sensorProjection.harness).toBe(target.harness);
        expect(table[target.harness].sensorProjection.harnessDir).toBe(target.directory);
        expect(table[target.harness].sensorProjection.invocation).toBe(target.invocation);
      }
    }
  });

  test(`${bundle.harness} copied native builder emits sensors under its explicit source context`, () => {
    const root = join(scratch, bundle.harness);
    const tools = join(root, "tools");
    const home = join(root, "home");
    const temp = join(root, "temp");
    mkdirSync(home, { recursive: true }); mkdirSync(temp, { recursive: true });
    cpSync(join(repo, "dist-release", bundle.harness, bundle.directory, "tools"), tools, { recursive: true });
    const targets = bundle.harness === "claude" ? cases : [bundle];
    for (const target of targets) {
      const out = join(root, "output", target.harness);
      const result = spawnSync(process.execPath, ["--no-install", join(tools, "aidlc-plugin-build.ts"), plugin, target.harness, out, "--json"], {
        cwd: root, encoding: "utf8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
        env: { ...process.env, HOME: home, USERPROFILE: home, AIDLC_CONFIG_HOME: join(home, "aidlc"), XDG_CONFIG_HOME: join(home, ".config"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex"), OPENCODE_CONFIG_DIR: join(home, ".opencode"), TEMP: temp, TMP: temp },
      });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).valid).toBe(true);
      const linter = readFileSync(join(out, "sensors/aidlc-linter.md"), "utf8");
      expect(linter.split(/\r?\n/).find((line) => line.startsWith("command:"))).toBe(target.command);
      expect(readFileSync(join(out, "sensors/aidlc-coverage-threshold.md")))
        .toEqual(readFileSync(join(repo, "dist/plugins/test-pro", target.harness, "sensors/aidlc-coverage-threshold.md")));
    }
  });
}
