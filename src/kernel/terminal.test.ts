import { describe, expect, test } from "bun:test";
import { createRecordingStreams } from "./fixtures/terminal.fake.ts";
import { createProcessTerminal } from "./terminal.ts";

describe("createProcessTerminal over its stream seam", () => {
  test("writes text to the standard output stream only", () => {
    const seam = createRecordingStreams();
    createProcessTerminal({ streams: seam.streams }).write("hello");

    expect({ out: seam.out, err: seam.err }).toEqual({ out: ["hello"], err: [] });
  });

  test("writes error text to the standard error stream only", () => {
    const seam = createRecordingStreams();
    createProcessTerminal({ streams: seam.streams }).writeError("failed");

    expect({ out: seam.out, err: seam.err }).toEqual({ out: [], err: ["failed"] });
  });
});