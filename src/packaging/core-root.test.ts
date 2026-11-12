import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../kernel/result.ts";
import { version as frameworkVersion } from "../kernel/fixtures/values.fixture.ts";
import { createBuildPackaging } from "./core-root.ts";

test("Packaging captures one build version and binds it into its stamp", () => {
  const version = mock(() => accepted("2.11.4-preview.20261109.1"));
  const packaging = createBuildPackaging(version);
  expect(version).toHaveBeenCalledTimes(1);
  expect(packaging.version).toEqual(accepted(frameworkVersion("2.11.4-preview.20261109.1")));
  expect(packaging.stamp({ kind: "text", text: 'export const AIDLC_VERSION = "2.11.3";' }))
    .toEqual(accepted({ kind: "text", text: 'export const AIDLC_VERSION = "2.11.4-preview.20261109.1";' }));
});

test("the captured source refusal is shared by version access and stamping", () => {
  const failure = { kind: "version-unstampable" as const, reason: "Invalid build version" };
  const version = mock(() => refused(failure));
  const packaging = createBuildPackaging(version);
  expect(packaging.version).toEqual(refused(failure));
  expect(packaging.stamp({ kind: "text", text: "unchanged" })).toEqual(refused(failure));
  expect(version).toHaveBeenCalledTimes(1);
});

test("a captured value passes the kernel version decoder before becoming a payload version", () => {
  expect(createBuildPackaging(() => accepted("not a version")).version)
    .toEqual({ ok: false, refusal: { kind: "invalid-framework-version", raw: "not a version" } });
});
