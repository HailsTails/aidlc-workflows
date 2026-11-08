import { describe, expect, test } from "bun:test";
import { CHANNELS } from "./payload.ts";

describe("CHANNELS", () => {
  test("lists the copy and native channels", () => {
    expect(CHANNELS).toEqual(["copy", "native"]);
  });
});
