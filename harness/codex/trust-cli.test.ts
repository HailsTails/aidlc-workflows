import { expect, test } from "bun:test";
import cases from "./fixtures/trust-cli93a.json";

const packageScript = Bun.fileURLToPath(new URL("../../scripts/package.ts", import.meta.url));

test.each(cases)("trust CLI retains pinned stdout, newline, stderr and exit status: $label", sample => {
  const executed = Bun.spawnSync([process.execPath, "--no-env-file", "--no-install", packageScript, ...sample.args], { stdout: "pipe", stderr: "pipe", env: { ...process.env, ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]) } });
  expect(executed.exitCode).toBe(sample.status);
  expect(executed.stdout.toString()).toBe(sample.stdout);
  expect(executed.stderr.toString()).toBe(sample.stderr);
});
