import { describe, expect, test } from "bun:test";
import { NEUTRAL_DOCUMENT_ROLES } from "./neutral-surface.ts";

describe("NEUTRAL_DOCUMENT_ROLES", () => {
  test("lists the roles of every core document a host places: protocols, templates, the conductor, stages and knowledge", () => {
    expect(NEUTRAL_DOCUMENT_ROLES).toEqual(["protocol", "template", "conductor", "stage", "knowledge"]);
  });
});
