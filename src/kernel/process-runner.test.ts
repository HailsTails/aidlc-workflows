import { describe, expect, test } from "bun:test";
import { createRecordingProcessLib } from "./fixtures/process-runner.fake.ts";
import { createNodeProcessRunner } from "./process-runner.ts";

const finished = { exitCode: 0, signalCode: null, stdout: "out", stderr: "err" };

describe("createNodeProcessRunner over its process library seam", () => {
  test("runs the current runtime with paths and the runtime folder rendered natively", async () => {
    const recording = createRecordingProcessLib({ exit: finished });
    const runner = createNodeProcessRunner({ processLib: recording.processLib });

    await runner.runCurrentRuntime({ argv: ["--no-install", { kind: "path", location: new URL("file:///tree/child.ts") }],
      env: { ["PATH"]: { kind: "runtime-folder" }, ["AIDLC_SRC"]: { kind: "path", location: new URL("file:///tree/") } },
      cwd: new URL("file:///scratch/output/"), input: "{}" });

    expect(recording.spawned()).toEqual([{ command: ["/runtime/bin/bun", "--no-install", "native:/tree/child.ts"],
      env: { ["PATH"]: "/runtime/bin/", ["AIDLC_SRC"]: "native:/tree/" }, cwd: "native:/scratch/output/", input: "{}" }]);
  });

  test("returns the child's exit code and output", async () => {
    const runner = createNodeProcessRunner({ processLib: createRecordingProcessLib({ exit: finished }).processLib });

    expect(await runner.runCurrentRuntime({ argv: [], env: {}, cwd: new URL("file:///scratch/"), input: "" }))
      .toEqual({ ok: true, value: { exit: { kind: "exited", code: 0 }, stdout: "out", stderr: "err" } });
  });

  test("returns a child ended by a signal as signalled", async () => {
    const runner = createNodeProcessRunner({ processLib: createRecordingProcessLib({
      exit: { exitCode: null, signalCode: "SIGKILL", stdout: "", stderr: "" } }).processLib });

    expect(await runner.runCurrentRuntime({ argv: [], env: {}, cwd: new URL("file:///scratch/"), input: "" }))
      .toEqual({ ok: true, value: { exit: { kind: "signalled", signal: "SIGKILL" }, stdout: "", stderr: "" } });
  });

  test("returns a child that could not start as not started, with the reason", async () => {
    const runner = createNodeProcessRunner({ processLib: { ...createRecordingProcessLib({ exit: finished }).processLib,
      spawn: async () => Promise.reject(new Error("no such folder")) } });

    expect(await runner.runCurrentRuntime({ argv: [], env: {}, cwd: new URL("file:///scratch/"), input: "" }))
      .toEqual({ ok: false, refusal: { kind: "not-started", reason: "no such folder" } });
  });
});
