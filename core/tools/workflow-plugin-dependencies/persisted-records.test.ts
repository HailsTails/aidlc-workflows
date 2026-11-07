import { expect, test } from "bun:test";
import { decodeOwnership, decodeState } from "./persisted-records.ts";

test("state decoding preserves exact persisted tokens without making eligibility decisions", () => {
  expect(decodeState({ status: "Parked", scope: "review", rows: [
    { slug: "done", state: "completed", suffix: "EXECUTE" },
    { slug: "skip", state: "skipped", suffix: "EXECUTE (planned)" },
    { slug: "pending", state: "Completed", suffix: " EXECUTE" },
    { slug: "unknown", state: "waiting", suffix: "execute" },
  ] })).toEqual({ lifecycle: "other", scope: "review", stages: [
    { name: "done", progress: "completed", action: "execute" },
    { name: "skip", progress: "skipped", action: "execute" },
    { name: "pending", progress: "other", action: "other" },
    { name: "unknown", progress: "other", action: "other" },
  ] });
});

test.each([
  { status: "Completed", lifecycle: "completed" },
  { status: "Archived", lifecycle: "archived" },
  { status: "completed", lifecycle: "other" },
  { status: "", lifecycle: "other" },
])("lifecycle decoding is case-sensitive: $status", ({ status, lifecycle }) => {
  expect(decodeState({ status, scope: null, rows: [] })).toEqual({ lifecycle, scope: null, stages: [] });
});

test("ownership decoding preserves duplicate order and omitted or empty owners", () => {
  expect(decodeOwnership(
    [{ name: "feature" }, { name: "review", plugin: "" }],
    [
      { slug: "check", phase: "initialization", plugin: "first" },
      { slug: "check", phase: "Initialization", plugin: "last" },
      { slug: "core", phase: "construction" },
    ],
  )).toEqual({
    scopes: [{ name: "feature" }, { name: "review", plugin: "" }],
    stages: [
      { name: "check", phase: "initialization", plugin: "first" },
      { name: "check", phase: "other", plugin: "last" },
      { name: "core", phase: "other", plugin: undefined },
    ],
  });
});
