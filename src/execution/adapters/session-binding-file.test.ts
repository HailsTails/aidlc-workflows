import { describe, expect, test } from "bun:test";
import { SessionBindingFileSchema, type SessionBindingFile } from "./session-binding-file.ts";

const switchedBinding: SessionBindingFile = {
  space: "default",
  intent: "261108-checkout-flow",
  boundAt: "2026-11-08T09:30:00Z",
  source: "switch",
};

const bindingBeforeSources: SessionBindingFile = {
  space: "payments",
  intent: null,
  boundAt: "2026-03-14T16:05:12Z",
};

describe("SessionBindingFileSchema", () => {
  test("reads a binding to a record with the way it was bound", () => {
    expect(SessionBindingFileSchema.parse(switchedBinding)).toEqual(switchedBinding);
  });

  test("reads a binding to no record written before sources were recorded", () => {
    expect(SessionBindingFileSchema.parse(bindingBeforeSources)).toEqual(bindingBeforeSources);
  });

  test("reads a binding stamped with milliseconds", () => {
    expect(
      SessionBindingFileSchema.parse({ ...switchedBinding, boundAt: "2026-11-08T09:30:00.123Z" }),
    ).toEqual({ ...switchedBinding, boundAt: "2026-11-08T09:30:00.123Z" });
  });

  test("refuses a source it does not know", () => {
    expect(
      SessionBindingFileSchema.safeParse({ ...switchedBinding, source: "guessed" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["source"] }] },
    });
  });

  test("refuses a bound time that is only a date", () => {
    expect(
      SessionBindingFileSchema.safeParse({ ...switchedBinding, boundAt: "2026-11-08" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["boundAt"] }] },
    });
  });

  test("refuses an empty space name", () => {
    expect(SessionBindingFileSchema.safeParse({ ...switchedBinding, space: "" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "too_small", path: ["space"] }] },
    });
  });
});
