import { expect, test } from "bun:test";
import { collectNativeFiles } from "./native-file-set.ts";
test("empty file sets and equal contents at distinct destinations are valid", () => {
  expect(collectNativeFiles({ resources: [] })).toEqual({ status: "ok", value: [] });
  expect(collectNativeFiles({ resources: [{ kind: "file", path: "a", body: "same" }, { kind: "file", path: "b", body: "same" }] })).toEqual({ status: "ok", value: [{ kind: "file", path: "a", body: "same" }, { kind: "file", path: "b", body: "same" }] });
});
test("even identical repeated destinations refuse", () => {
  expect(collectNativeFiles({ resources: [{ kind: "file", path: "a", body: "same" }, { kind: "file", path: "a", body: "same" }] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "a", detail: "native file set must emit each destination once" }] });
});
test("registration fragments cannot bypass their owner's reconciliation", () => {
  expect(collectNativeFiles({ resources: [{ kind: "registration", path: "a", body: "fragment" }] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "a", detail: "native file sets require assembled files; registration fragments must be reconciled by their owner first" }] });
});
