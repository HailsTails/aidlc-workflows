import { describe, expect, test } from "bun:test";
import { createRecordingProcessLib, createScriptedProcessRunner } from "./process-runner.fake.ts";

describe("createScriptedProcessRunner", () => {
  test("answers every run with its scripted outcome and keeps each request", async () => {
    const runner = createScriptedProcessRunner({ outcome: { ok: true,
      value: { exit: { kind: "exited", code: 0 }, stdout: "{}", stderr: "" } } });
    const request = { argv: ["child.ts"], env: {}, cwd: new URL("file:///scratch/"), input: "{}" };

    expect({ outcome: await runner.runCurrentRuntime(request), received: runner.received() }).toEqual({
      outcome: { ok: true, value: { exit: { kind: "exited", code: 0 }, stdout: "{}", stderr: "" } },
      received: [request],
    });
  });
});

describe("createRecordingProcessLib", () => {
  test("keeps each native request and answers with its exit", async () => {
    const recording = createRecordingProcessLib({ exit: { exitCode: 0, signalCode: null, stdout: "", stderr: "" } });
    const request = { command: ["/runtime/bin/bun"], env: {}, cwd: "/scratch", input: "" };

    expect({ exit: await recording.processLib.spawn(request), spawned: recording.spawned() }).toEqual({
      exit: { exitCode: 0, signalCode: null, stdout: "", stderr: "" },
      spawned: [request],
    });
  });
});
