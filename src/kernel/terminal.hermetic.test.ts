import { describe, expect, test } from "bun:test";
import { createProcessTerminal } from "./terminal.ts";

describe("createProcessTerminal on the real process streams", () => {
  test("accepts empty writes on both streams", () => {
    const terminal = createProcessTerminal();

    expect(() => {
      terminal.write("");
      terminal.writeError("");
    }).not.toThrow();
  });
});