// covers: file:scripts/project-core-session.ts, file:scripts/projection/src/adapters/source-host-emission.ts
import { test, expect } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS } from "../harness/test-budget.ts";

const repository = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
test("source sessions preserve shared callback state in host/channel/pass order and reset on the next command", () => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-emit-session-"));
  const trace = join(root, "callback-trace.jsonl");
  try {
    for (const path of ["core", "scripts", "package.json", "bun.lock"]) cpSync(join(repository, path), join(root, path), { recursive: true });
    mkdirSync(join(root, "harness"));
    const dependencies = join(repository, "node_modules");
    if (!existsSync(dependencies)) throw new Error("Session fixtures require the checkout's installed dependencies");
    symlinkSync(dependencies, join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    for (const host of ["claude", "opencode"]) {
      cpSync(join(repository, "harness", host), join(root, "harness", host), { recursive: true });
      const manifest = join(root, "harness", host, "manifest.ts");
      const callback = `import { next } from "../shared-session-counter.ts";
const previous = manifest.emit;
manifest.emit = (ctx) => { previous?.(ctx); const fs = require("node:fs"), path = require("node:path"), { count, value } = next();
fs.mkdirSync(path.join(ctx.distRoot, "extension-probe"), { recursive: true });
fs.writeFileSync(path.join(ctx.distRoot, "extension-probe/count.txt"), String(value));
console.log("emit stdout " + ctx.harnessName + " " + count); console.error("emit stderr " + ctx.harnessName + " " + count);
fs.appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ host: ctx.harnessName, channel: ctx.substituteToken("{{INVOKE}}") === "aidlc" ? "native" : "copy", count, value, pid: process.pid }) + "\\n"); };
`;
      writeFileSync(manifest, readFileSync(manifest, "utf8").replace("export default manifest;", callback + "export default manifest;"));
    }
    const execute = (check: boolean) => {
      writeFileSync(trace, "");
      const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", "scripts/package.ts", ...(check ? ["--check"] : [])], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS });
      return { result, events: readFileSync(trace, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as { host: string; channel: string; count: number; value: number; pid: number }) };
    };
    for (const modulo of [false, true]) {
      writeFileSync(join(root, "harness/shared-session-counter.ts"), `let count = 0; export function next() { count++; return { count, value: ${modulo ? "count % 4" : "count"} }; }\n`);
      const ordinary = execute(false);
      expect(ordinary.result.status).toBe(0);
      expect(ordinary.result.stdout.split("\n").filter(line => line.startsWith("emit stdout"))).toEqual(ordinary.events.map(event => `emit stdout ${event.host} ${event.count}`));
      expect(ordinary.result.stderr.trim().split("\n")).toEqual(ordinary.events.map(event => `emit stderr ${event.host} ${event.count}`));
      expect(ordinary.events.map(event => event.count)).toEqual([1, 2, 3, 4]);
      expect(ordinary.events.map(event => [event.host, event.channel])).toEqual([["claude", "copy"], ["claude", "native"], ["opencode", "copy"], ["opencode", "native"]]);
      expect(new Set(ordinary.events.map(event => event.pid)).size).toBe(1);
      const outputs = [join(root, "dist/claude"), join(root, "dist-release/claude"), join(root, "dist/opencode"), join(root, "dist-release/opencode")].map(output => readFileSync(join(output, "extension-probe/count.txt"), "utf8"));
      expect(outputs).toEqual(modulo ? ["1", "2", "3", "0"] : ["1", "2", "3", "4"]);
      const checked = execute(true);
      expect(checked.result.status).toBe(modulo ? 0 : 1);
      expect(checked.events.map(event => event.count)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(new Set(checked.events.map(event => event.pid)).size).toBe(1);
      expect(checked.result.stdout.split("\n").filter(line => line.startsWith("emit stdout"))).toEqual(checked.events.map(event => `emit stdout ${event.host} ${event.count}`));
      expect(checked.result.stderr.split("\n").filter(line => line.startsWith("emit stderr"))).toEqual(checked.events.map(event => `emit stderr ${event.host} ${event.count}`));
      if (!modulo) expect(checked.result.stderr.replaceAll("\\", "/")).toContain("DIFFERS between builds: dist/claude/extension-probe/count.txt");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS);
