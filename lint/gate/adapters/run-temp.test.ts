import { describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { processRunner } from "./process-runner.ts";
import { runTemp } from "./run-temp.ts";

const ROOT = join(import.meta.dir, "../../..");
const PRINT = "console.log([process.env.TEMP, process.env.TMP, " +
  "process.env.TMPDIR, process.env.AIDLC_TEST_TEMP_ROOT].join('|'))";
const PRINT_TEMPS = [process.execPath, "-e", PRINT];

describe("the per-run temp folder", () => {
  test("it is made beside the main checkout, not in the user temp, and removed on dispose", () => {
    const temp = runTemp(ROOT);
    expect(existsSync(temp.path)).toBe(true);
    expect(dirname(temp.path).endsWith(join(".cache", "tmp"))).toBe(true);
    temp.dispose();
    expect(existsSync(temp.path)).toBe(false);
  });

  test("every child gets it as TEMP, TMP and TMPDIR, whatever the caller had set", () => {
    const temp = runTemp(ROOT);
    const runner = processRunner(ROOT, temp.path);
    const inherited = runner.capture({ label: "inherit", argv: PRINT_TEMPS });
    const explicit = runner.capture({
      label: "explicit",
      argv: PRINT_TEMPS,
      env: { TEMP: "C:\\elsewhere", PATH: process.env["PATH"] ?? "" },
    });
    temp.dispose();
    const expected = [temp.path, temp.path, temp.path, temp.path].join("|");
    expect(inherited.output.trim()).toBe(expected);
    expect(explicit.output.trim()).toBe(expected);
  });
});


const controlledChild = (label: string, started: string[]) => {
  const exit = Promise.withResolvers<number>();
  const launch = Promise.withResolvers<undefined>();
  return {
    started: launch.promise,
    finish: () => exit.resolve(0),
    spawn: () => {
      started.push(label);
      launch.resolve(undefined);
      return {
        stdout: new Response(label).body,
        stderr: new Response("").body,
        exited: exit.promise,
      } as ReturnType<typeof Bun.spawn>;
    },
  };
};
const controlledSpawns = () => {
  const started: string[] = [];
  const a = controlledChild("a", started);
  const b = controlledChild("b", started);
  const c = controlledChild("c", started);
  const d = controlledChild("d", started);
  const spawn = spyOn(Bun, "spawn")
    .mockImplementationOnce(a.spawn)
    .mockImplementationOnce(b.spawn)
    .mockImplementationOnce(c.spawn)
    .mockImplementationOnce(d.spawn);
  return {
    started, a, b, c, d,
    dispose: () => {
      a.finish();
      b.finish();
      c.finish();
      d.finish();
      spawn.mockRestore();
    },
  };
};
describe("captureAll", () => {
  const PRINT_LABEL = "console.log(process.argv[1])";
  const printing = (label: string) => ({
    label,
    argv: [process.execPath, "-e", PRINT_LABEL, label],
  });

  test("results come back in command order whatever order they finish in", async () => {
    const temp = runTemp(ROOT);
    const runner = processRunner(ROOT, temp.path);
    const results = await runner.captureAll({
      commands: [printing("a"), printing("b"), printing("c")],
      concurrency: 3,
    });
    temp.dispose();
    expect(results.map((result) => result.output.trim())).toEqual(["a", "b", "c"]);
  });

  test("commands run side by side up to the limit", async () => {
    const { started, a, b, c, d, dispose } = controlledSpawns();
    try {
      const pending = processRunner(ROOT, ROOT).captureAll({
        commands: [printing("a"), printing("b"), printing("c"), printing("d")],
        concurrency: 2,
      });
      expect(started).toEqual(["a", "b"]);
      b.finish();
      await c.started;
      expect(started).toEqual(["a", "b", "c"]);
      c.finish();
      await d.started;
      expect(started).toEqual(["a", "b", "c", "d"]);
      d.finish();
      a.finish();
      expect(await pending).toEqual([
        { exitCode: 0, output: "a" },
        { exitCode: 0, output: "b" },
        { exitCode: 0, output: "c" },
        { exitCode: 0, output: "d" },
      ]);
    } finally {
      dispose();
    }
  });
});
describe("fixture depth within the gate boundary", () => {
  test("file fixtures keep a real project leaf short and independently removable", () => {
    const temp = runTemp(ROOT);
    const script = `
      const { createE2eTemporaryRoot } = await import("./tests/lib/e2e-workers.ts");
      const { mkdtempSync, rmSync, existsSync } = await import("node:fs");
      const { join, dirname } = await import("node:path");
      const first = await createE2eTemporaryRoot();
      const second = await createE2eTemporaryRoot();
      const leaf = mkdtempSync(join(first, "aidlc-t243-quiet-"));
      const child = Bun.spawnSync([process.execPath, "-e",
        'const {createE2eTemporaryRoot}=await import("./tests/lib/e2e-workers.ts");' +
        'console.log(await createE2eTemporaryRoot());'],
        {env:{...process.env,TEMP:first,TMP:first,TMPDIR:first}});
      if (child.exitCode !== 0) throw Error(child.stderr.toString());
      const nested = child.stdout.toString().trim();
      rmSync(first, {recursive:true});
      console.log(JSON.stringify({first,second,leaf,nested,
        firstRemoved:!existsSync(first),nestedRemoved:!existsSync(nested),
        secondSurvives:existsSync(second)}));
    `;
    try {
      const result = processRunner(ROOT, temp.path).capture({
        label: "fixture leaf", argv: [process.execPath, "-e", script],
      });
      expect(result.exitCode, result.output).toBe(0);
      const paths = JSON.parse(result.output);
      expect(dirname(paths.first)).toBe(temp.path);
      expect(dirname(paths.second)).toBe(temp.path);
      expect(paths.first).not.toBe(paths.second);
      expect(dirname(paths.nested)).toBe(paths.first);
      expect(parse(paths.leaf).root).toBe(parse(temp.path).root);
      expect(paths.firstRemoved && paths.nestedRemoved && paths.secondSurvives).toBe(true);
      if (process.platform === "win32") expect(paths.leaf.length).toBeLessThan(75);
    } finally {
      temp.dispose();
    }
    expect(existsSync(temp.path)).toBe(false);
  });
});