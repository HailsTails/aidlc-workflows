import { describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processRunner } from "./process-runner.ts";
import { observeProgress, progressLines, runnerProgress } from "./runner-progress.ts";

describe("runner progress observations", () => {
  test("uses selected inventory and distinguishes outcomes from active retry", () => {
    const progress = runnerProgress(() => 1000);
    const snapshot = {
      files: ["a", "b", "c"], logs: "logs",
      outcomes: new Map([["a", { status: "PASS" as const }], ["b", { status: "SKIP" as const }]]),
    };
    expect(progress.line(snapshot)).toContain("file outcomes 2/3 (PASS 1, FAIL 0, SKIP 1)");
    progress.start("a");
    expect(progress.line(snapshot)).toContain("file outcomes 1/3");
    expect(progress.line(snapshot)).toContain("active: a (0s)");
    progress.finish("a");
    expect(progress.line(snapshot)).toContain("file outcomes 2/3");
  });

  test("timer observations alone do not reset advancement or claim a hang", () => {
    let now = 0;
    const progress = runnerProgress(() => now);
    const snapshot = { files: ["long"], outcomes: new Map(), logs: "logs" };
    progress.start("long");
    now = 30_000;
    expect(progress.line(snapshot)).toContain("last observed advancement 30s ago");
    now = 301_000;
    expect(progress.line(snapshot)).toContain("last observed advancement 301s ago");
    expect(progress.line(snapshot)).toContain("silence is not proof of a hang");
    expect(progress.line(snapshot)).toContain("long (301s)");
  });

  test("qualified names remain distinct and new outcomes advance observations", () => {
    let now = 0;
    const progress = runnerProgress(() => now);
    progress.start("plugin-a/test");
    progress.start("plugin-b/test");
    const outcomes = new Map<string, { status: "PASS" | "FAIL" | "SKIP" }>();
    const snapshot = { files: ["plugin-a/test", "plugin-b/test"], outcomes, logs: "logs" };
    now = 40_000;
    progress.finish("plugin-a/test");
    outcomes.set("plugin-a/test", { status: "FAIL" });
    const line = progress.line(snapshot);
    expect(line).toContain("file outcomes 1/2 (PASS 0, FAIL 1, SKIP 0)");
    expect(line).toContain("active: plugin-b/test (40s)");
    expect(line).toContain("last observed advancement 0s ago");
  });

  test("does not invent missing results when execution throws", () => {
    const progress = runnerProgress(() => 0);
    progress.start("broken");
    progress.finish("broken");
    const line = progress.line({ files: ["broken"], outcomes: new Map(), logs: "logs" });
    expect(line).toContain("file outcomes 0/1");
    expect(line).toContain("dispatch/setup/cleanup may remain");
  });
});

describe("progress forwarding", () => {
  test("async capture retains original output and forwards progress before exit", async () => {
    const temp = mkdtempSync(join(tmpdir(), "aidlc-progress-probe-"));
    const lines: string[] = [];
    let completed = false;
    const beforeCompletion: boolean[] = [];
    const write = spyOn(process.stderr, "write").mockImplementation((line) => {
      lines.push(String(line));
      beforeCompletion.push(!completed);
      return true;
    });
    try {
      const runner = processRunner(process.cwd(), temp);
      const results = await runner.captureAll({ concurrency: 1, commands: [{
        label: "synthetic progress child",
        argv: [process.execPath, "-e", [
          'process.stdout.write("noise\\n");',
          'process.stderr.write("AIDLC_PROGRESS synthetic\\n");',
          'await Bun.sleep(20); process.stdout.write("done\\n");',
        ].join(" ")],
      }] });
      completed = true;
      expect(results).toEqual([{ exitCode: 0, output: "noise\ndone\nAIDLC_PROGRESS synthetic\n" }]);
      expect(lines).toEqual(["AIDLC_PROGRESS synthetic\n"]);
      expect(beforeCompletion).toEqual([true]);
    } finally {
      write.mockRestore();
      rmSync(temp, { recursive: true, force: true });
    }
  });

  test("forwards only complete progress lines across chunk boundaries", () => {
    const lines: string[] = [];
    const feed = progressLines((line) => lines.push(line));
    feed("ordinary output\nAIDLC_PRO");
    feed("GRESS file outcomes 1/2\nnoise\n");
    expect(lines).toEqual(["AIDLC_PROGRESS file outcomes 1/2\n"]);
  });

  test("drops oversized lines and recovers at the next newline", () => {
    const lines: string[] = [];
    const feed = progressLines((line) => lines.push(line));
    feed(`AIDLC_PROGRESS ${"x".repeat(17000)}`);
    feed("discard\nAIDLC_PROGRESS ok\n");
    expect(lines).toEqual(["AIDLC_PROGRESS ok\n"]);
  });
});


describe("observation failure isolation", () => {
  test("line construction cannot throw into its caller", () => {
    expect(() => observeProgress(() => {
      throw new Error("line build failed");
    })).not.toThrow();
  });

  test.each([false, true])("throwing stderr preserves synthetic run outcome: %s", (fail) => {
    const helper = new URL("./runner-progress.ts", import.meta.url).href;
    const code = [
      `import { observeProgress } from ${JSON.stringify(helper)};`,
      'process.stderr.write = () => { throw new Error("stderr failed"); };',
      'const report = () => observeProgress(() => process.stderr.write("progress"));',
      'const timer = setInterval(report, 1); await Bun.sleep(5);',
      'let exitCode = 0; let diagnostic = "success"; let cleaned = false;',
      'try {',
      `if (${fail}) throw new Error("original failure");`,
      'report(); cleaned = true;',
      '} catch (error) { report(); diagnostic = error.message; cleaned = true; exitCode = 7; }',
      'clearInterval(timer);',
      'process.stdout.write(JSON.stringify({ diagnostic, cleaned }));',
      'process.exitCode = exitCode;',
    ].join("\n");
    const result = Bun.spawnSync([process.execPath, "-e", code], {
      stdout: "pipe", stderr: "pipe", env: process.env,
    });
    expect(result.exitCode).toBe(fail ? 7 : 0);
    expect(JSON.parse(result.stdout.toString())).toEqual({
      diagnostic: fail ? "original failure" : "success", cleaned: true,
    });
    expect(result.stderr.toString()).toBe("");
  });

});

describe("forwarding failure isolation", () => {
  test.each([0, 7])("forwarding write failure preserves child exit %s and output", async (exit) => {
    const temp = mkdtempSync(join(tmpdir(), "aidlc-progress-write-probe-"));
    const originalWrite = process.stderr.write.bind(process.stderr);
    const write = spyOn(process.stderr, "write").mockImplementation((line) => {
      if (String(line).startsWith("AIDLC_PROGRESS ")) throw new Error("stderr failed");
      return originalWrite(line);
    });
    try {
      const runner = processRunner(temp, temp);
      const results = await runner.captureAll({ concurrency: 1, commands: [{
        label: "synthetic progress failure",
        argv: [process.execPath, "-e", [
          'process.stderr.write("AIDLC_PROGRESS synthetic\\n");',
          'process.stdout.write("original diagnostic\\n");',
          `process.exitCode = ${exit};`,
        ].join(" ")],
      }] });
      expect(results).toEqual([{
        exitCode: exit, output: "original diagnostic\nAIDLC_PROGRESS synthetic\n",
      }]);
    } finally {
      write.mockRestore();
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
