import { expect, mock, test } from "bun:test";
import { combineProjectionSets, createProjectionCombinationRules, type ProjectionCombinationRules } from "./combine-projections.ts";
import type { ProjectedSetUnit, ProjectionSet } from "./projection-set.ts";
import { collectNativeFiles } from "../domain/native-file-set.ts";
import type { NativeResource } from "../domain/native-rendering.ts";

const firstResource: NativeResource = { kind: "file", path: ".claude/knowledge/first.md", body: "First\n" };
const secondResource: NativeResource = { kind: "file", path: ".claude/knowledge/second.md", body: "Second\n" };
const firstUnit: ProjectedSetUnit = { kind: "knowledge", key: "first", projection: {
  origin: { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/knowledge/first.md" }, harness: "claude", resources: [firstResource],
} };
const secondUnit: ProjectedSetUnit = { kind: "knowledge", key: "second", projection: {
  origin: { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/knowledge/second.md" }, harness: "claude", resources: [secondResource],
} };
const firstSet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [firstUnit], resources: [firstResource] };
const secondSet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [secondUnit], resources: [secondResource] };

test("combines ordered owned units and uses the collector's admitted files", () => {
  const collect = mock<ProjectionCombinationRules["collect"]>().mockReturnValue({ status: "ok", value: [{ kind: "file", path: ".claude/knowledge/collected.md", body: "Collector output\n" }] });
  expect(combineProjectionSets({ target: { harness: "claude", directory: ".claude" }, sets: [firstSet, secondSet], rules: { collect } })).toEqual({ status: "ok", value: {
    scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [firstUnit, secondUnit], resources: [{ kind: "file", path: ".claude/knowledge/collected.md", body: "Collector output\n" }],
  } });
  expect(collect.mock.calls).toEqual([[{ resources: [
    { kind: "file", path: ".claude/knowledge/first.md", body: "First\n" },
    { kind: "file", path: ".claude/knowledge/second.md", body: "Second\n" },
  ] }]]);
});

test("a single nonempty contributor is valid", () => {
  const collect = mock<ProjectionCombinationRules["collect"]>().mockReturnValue({ status: "ok", value: [firstResource] });
  expect(combineProjectionSets({ target: { harness: "claude", directory: ".claude" }, sets: [firstSet], rules: { collect } })).toEqual({ status: "ok", value: {
    scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [firstUnit], resources: [{ kind: "file", path: ".claude/knowledge/first.md", body: "First\n" }],
  } });
  expect(collect.mock.calls).toEqual([[{ resources: [{ kind: "file", path: ".claude/knowledge/first.md", body: "First\n" }] }]]);
});

test("empty contribution selection refuses before collection", () => {
  const collect = mock<ProjectionCombinationRules["collect"]>().mockReturnValue({ status: "ok", value: [] });
  expect(combineProjectionSets({ target: { harness: "claude", directory: ".claude" }, sets: [], rules: { collect } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "projection-composition", detail: "combine nonempty prepared projections for one exact harness binding" }] });
  expect(collect).not.toHaveBeenCalled();
});

test("foreign target binding refuses before collection", () => {
  const collect = mock<ProjectionCombinationRules["collect"]>().mockReturnValue({ status: "ok", value: [] });
  const foreignResource: NativeResource = { kind: "file", path: ".cursor/knowledge/foreign.md", body: "Foreign\n" };
  const foreignSet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "cursor", directory: ".cursor" }, units: [{ kind: "knowledge", key: "foreign", projection: {
    origin: { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/knowledge/foreign.md" }, harness: "cursor", resources: [foreignResource],
  } }], resources: [foreignResource] };
  expect(combineProjectionSets({ target: { harness: "claude", directory: ".claude" }, sets: [firstSet, foreignSet], rules: { collect } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "projection-composition", detail: "combine nonempty prepared projections for one exact harness binding" }] });
  expect(collect).not.toHaveBeenCalled();
});

test("a matching directory cannot bypass a different harness identity", () => {
  const collect = mock<ProjectionCombinationRules["collect"]>().mockReturnValue({ status: "ok", value: [] });
  const foreignResource: NativeResource = { kind: "file", path: ".kiro/knowledge/foreign.md", body: "Foreign\n" };
  const foreignSet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "kiro-ide", directory: ".kiro" }, units: [{ kind: "knowledge", key: "foreign", projection: {
    origin: { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/knowledge/foreign.md" }, harness: "kiro-ide", resources: [foreignResource],
  } }], resources: [foreignResource] };
  expect(combineProjectionSets({ target: { harness: "kiro", directory: ".kiro" }, sets: [foreignSet], rules: { collect } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "projection-composition", detail: "combine nonempty prepared projections for one exact harness binding" }] });
  expect(collect).not.toHaveBeenCalled();
});

test("duplicate unit identities across otherwise distinct contributors refuse", () => {
  const collect = mock<ProjectionCombinationRules["collect"]>().mockReturnValue({ status: "ok", value: [] });
  const duplicateSet: ProjectionSet = { ...secondSet, units: [{ ...secondUnit, key: "first" }] };
  expect(combineProjectionSets({ target: { harness: "claude", directory: ".claude" }, sets: [firstSet, duplicateSet], rules: { collect } })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "projection-composition", detail: "prepared projection unit identities must be unique across contributors" }] });
  expect(collect).not.toHaveBeenCalled();
});

test("collector refusal is preserved without returning a partial projection", () => {
  const collect = mock<ProjectionCombinationRules["collect"]>().mockReturnValue({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/knowledge/first.md", detail: "fixture collector refusal" }] });
  expect(combineProjectionSets({ target: { harness: "claude", directory: ".claude" }, sets: [firstSet, secondSet], rules: { collect } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/knowledge/first.md", detail: "fixture collector refusal" }] });
  expect(collect.mock.calls).toEqual([[{ resources: [
    { kind: "file", path: ".claude/knowledge/first.md", body: "First\n" },
    { kind: "file", path: ".claude/knowledge/second.md", body: "Second\n" },
  ] }]]);
});

test("the default factory binds the existing native file collector", () => {
  expect(createProjectionCombinationRules().collect).toBe(collectNativeFiles);
});
