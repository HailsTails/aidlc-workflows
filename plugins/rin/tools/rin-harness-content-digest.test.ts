import { describe, expect, test } from "vitest";
import { defaultContentDigestPort } from "./rin-harness-content-digest.ts";

const digests = defaultContentDigestPort();

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("content digest boundary", () => {
  test("digests text as its sha256 hex", () => {
    expect(digests.sha256Hex({ content: "abc" })).toBe(ABC_SHA256);
  });

  test("digests bytes identically to the same text", () => {
    expect(
      digests.sha256Hex({ content: new TextEncoder().encode("abc") }),
    ).toBe(ABC_SHA256);
  });

  test("digests empty content as the empty-input sha256", () => {
    expect(digests.sha256Hex({ content: new Uint8Array(0) })).toBe(EMPTY_SHA256);
  });
});
