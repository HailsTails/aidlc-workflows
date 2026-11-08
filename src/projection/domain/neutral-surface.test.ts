import { describe, expect, test } from "bun:test";
import { NEUTRAL_DOCUMENT_ROLES } from "./neutral-surface.ts";

describe("NEUTRAL_DOCUMENT_ROLES", () => {
  test("lists the protocol and template roles", () => {
    expect(NEUTRAL_DOCUMENT_ROLES).toEqual(["protocol", "template"]);
  });
});
