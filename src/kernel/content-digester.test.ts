import { describe, expect, test } from "bun:test";
import { createBunContentDigester } from "./content-digester.ts";
import { recordingDigestLib } from "./fixtures/content-digester.fake.ts";
import { contentHash } from "./values.ts";

const HEX = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("createBunContentDigester over its SHA-256 seam", () => {
  test("digests text content as its text", () => {
    const lib = recordingDigestLib({ hex: HEX });

    expect(createBunContentDigester({ digestLib: lib }).hash({ kind: "text", text: "abc" }))
      .toEqual(contentHash(`sha256:${HEX}`));
    expect(lib.received).toEqual(["abc"]);
  });

  test("digests byte content as its bytes", () => {
    const lib = recordingDigestLib({ hex: HEX });
    const bytes = new Uint8Array([0x61, 0x62, 0x63]);

    expect(createBunContentDigester({ digestLib: lib }).hash({ kind: "bytes", bytes }))
      .toEqual(contentHash(`sha256:${HEX}`));
    expect(lib.received).toEqual([bytes]);
  });

  test("refuses a digest that is not 64 lowercase hex characters", () => {
    const lib = recordingDigestLib({ hex: "ABC" });

    expect(createBunContentDigester({ digestLib: lib }).hash({ kind: "text", text: "abc" }))
      .toEqual({ ok: false, refusal: { kind: "invalid-content-hash", raw: "sha256:ABC" } });
  });
});
