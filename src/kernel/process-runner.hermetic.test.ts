import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createNodeProcessRunner } from "./process-runner.ts";

const runner = createNodeProcessRunner();
const scratch = { root: "" };

const CHILD = `const input = await Bun.stdin.text();
const found = require('node:fs').existsSync(process.argv.at(-1));
process.stdout.write([process.env.GREETING, input, found].join(':'));`;

beforeAll(async () => {
  scratch.root = await mkdtemp(join(tmpdir(), "aidlc-process-runner-"));
});

afterAll(async () => {
  await rm(scratch.root, { recursive: true, force: true });
});

describe("createNodeProcessRunner on the real runtime", () => {
  test("runs the current runtime with its arguments, environment, folder and input", async () => {
    const folder = pathToFileURL(`${scratch.root}/`);

    expect(await runner.runCurrentRuntime({
      argv: ["-e", CHILD, { kind: "path", location: folder }],
      env: { ["GREETING"]: "hello", ["PATH"]: { kind: "runtime-folder" } },
      cwd: folder,
      input: "ping",
    })).toEqual({ ok: true, value: { exit: { kind: "exited", code: 0 }, stdout: "hello:ping:true", stderr: "" } });
  });

  test("returns a missing working folder as not started", async () => {
    const outcome = await runner.runCurrentRuntime({ argv: ["-e", ""], env: {},
      cwd: pathToFileURL(join(scratch.root, "absent")), input: "" });

    expect(outcome).toMatchObject({ ok: false, refusal: { kind: "not-started" } });
  });
});
