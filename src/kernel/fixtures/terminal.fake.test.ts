import { describe, expect, test } from "bun:test";
import { createRecordingStreams, createRecordingTerminal } from "./terminal.fake.ts";

describe("createRecordingTerminal", () => {
  test("keeps output and error text apart, in order", () => {
    const terminal = createRecordingTerminal();
    terminal.write("a");
    terminal.writeError("x");
    terminal.write("b");

    expect({ output: terminal.output(), errors: terminal.errors() }).toEqual({ output: ["a", "b"], errors: ["x"] });
  });
});

describe("createRecordingStreams", () => {
  test("records each stream's writes apart", () => {
    const seam = createRecordingStreams();
    seam.streams.stdout.write("a");
    seam.streams.stderr.write("x");

    expect({ out: seam.out, err: seam.err }).toEqual({ out: ["a"], err: ["x"] });
  });
});