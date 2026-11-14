import { describe, expect, test } from "bun:test";
import { createBunContentDigester } from "./content-digester.ts";
import { contentHash } from "./values.ts";

const digester = createBunContentDigester();

describe("createBunContentDigester on the real runtime's SHA-256", () => {
  test("hashes empty text to the SHA-256 of no bytes", () => {
    expect(digester.hash({ kind: "text", text: "" }))
      .toEqual(contentHash("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
  });

  test("hashes text as its UTF-8 bytes", () => {
    expect(digester.hash({ kind: "text", text: "é" }))
      .toEqual(digester.hash({ kind: "bytes", bytes: new Uint8Array([0xc3, 0xa9]) }));
  });

  test("hashes bytes to the published SHA-256 of abc", () => {
    expect(digester.hash({ kind: "bytes", bytes: new Uint8Array([0x61, 0x62, 0x63]) }))
      .toEqual(contentHash("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  });
});
