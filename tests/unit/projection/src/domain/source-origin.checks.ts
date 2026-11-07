import { expect, test } from "bun:test";
import { mergeSourceDigests } from "../../../../../scripts/projection/src/domain/source-origin.ts";

test("identical overlapping witnesses deduplicate in first-observation order", () => {
  expect(mergeSourceDigests({ groups: [
    [{ path: "core/second.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
    [{ path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, { path: "core/second.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
    [{ path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, { path: "core/second.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
  ] })).toEqual({ status: "ok", value: [
    { path: "core/second.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    { path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  ] });
});

test("different hashes for one input refuse the composition", () => {
  expect(mergeSourceDigests({ groups: [
    [{ path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    [{ path: "core/first.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
  ] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/first.md", detail: "source preparations reported different digests for the same input; inspect source stability and witness representation before composing" }] });
});

test("different input paths may legitimately have different hashes", () => {
  expect(mergeSourceDigests({ groups: [
    [{ path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    [],
    [{ path: "core/second.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
  ] })).toEqual({ status: "ok", value: [
    { path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    { path: "core/second.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  ] });
});

test("equal hashes do not collapse distinct source paths", () => {
  expect(mergeSourceDigests({ groups: [
    [{ path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    [{ path: "core/second.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
  ] })).toEqual({ status: "ok", value: [
    { path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    { path: "core/second.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  ] });
});

test.each([{ groups: [] }, { groups: [[], []] }])("empty witness groups remain an empty successful merge: %s", ({ groups }) => {
  expect(mergeSourceDigests({ groups })).toEqual({ status: "ok", value: [] });
});

test("a conflicting observation cannot be hidden by an earlier identical duplicate", () => {
  expect(mergeSourceDigests({ groups: [
    [{ path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    [{ path: "core/first.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    [{ path: "core/first.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
  ] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/first.md", detail: "source preparations reported different digests for the same input; inspect source stability and witness representation before composing" }] });
});
