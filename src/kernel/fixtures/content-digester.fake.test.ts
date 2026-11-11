import { describe, expect, test } from "bun:test";
import { recordingDigestLib } from "./content-digester.fake.ts";

describe("recordingDigestLib", () => {
  test("returns its fixed hex and records each input it was given", () => {
    const lib = recordingDigestLib({ hex: "ab" });

    expect(lib.hexDigest("one")).toBe("ab");
    expect(lib.hexDigest(new Uint8Array([1]))).toBe("ab");
    expect(lib.received).toEqual(["one", new Uint8Array([1])]);
  });
});
