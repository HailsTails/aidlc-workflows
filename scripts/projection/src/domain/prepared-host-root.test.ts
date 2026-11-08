// Prepared host roots preserve payload, path membership and declared amendment evidence.
import { expect, test } from "bun:test";
import { admitPreparedHostRoot, compareDistributionFile, hostRootChanges, type DistributionFileComparison, type DistributionRoot, type HostRootChanges, type PreparedHostRoot } from "./prepared-host-root.ts";

const empty: DistributionRoot = { files: [], directories: [] };
const unchanged: HostRootChanges = { added: [], replaced: [], removed: [], directoriesAdded: [], directoriesChanged: [], directoriesRemoved: [] };

const comparisons: { readonly label: string; readonly left: readonly number[]; readonly right: readonly number[]; readonly leftMode: number; readonly rightMode: number; readonly expected: DistributionFileComparison }[] = [
  { label: "empty content", left: [], right: [], leftMode: 0, rightMode: 0, expected: "unchanged" },
  { label: "equal binary content in separate arrays", left: [0, 255, 128], right: [0, 255, 128], leftMode: 0o644, rightMode: 0o644, expected: "unchanged" },
  { label: "first byte", left: [0, 255], right: [1, 255], leftMode: 0o644, rightMode: 0o644, expected: "content-changed" },
  { label: "last byte", left: [0, 255], right: [0, 254], leftMode: 0o644, rightMode: 0o644, expected: "content-changed" },
  { label: "longer content with matching prefix", left: [0], right: [0, 255], leftMode: 0o644, rightMode: 0o644, expected: "content-changed" },
  { label: "shorter content with matching prefix", left: [0, 255], right: [0], leftMode: 0o644, rightMode: 0o644, expected: "content-changed" },
  { label: "new content", left: [], right: [0], leftMode: 0o644, rightMode: 0o644, expected: "content-changed" },
  { label: "emptied content", left: [0], right: [], leftMode: 0o644, rightMode: 0o644, expected: "content-changed" },
  { label: "executable mode only", left: [0, 255], right: [0, 255], leftMode: 0o644, rightMode: 0o755, expected: "mode-changed" },
  { label: "empty file mode only", left: [], right: [], leftMode: 0, rightMode: 0o777, expected: "mode-changed" },
  { label: "both payload dimensions", left: [0, 255], right: [0, 254], leftMode: 0o644, rightMode: 0o755, expected: "content-and-mode-changed" },
];
test.each(comparisons)("file comparison names $label", ({ left, right, leftMode, rightMode, expected }) => {
  expect(compareDistributionFile({ path: "asset", bytes: new Uint8Array(left), mode: leftMode }, { path: "asset", bytes: new Uint8Array(right), mode: rightMode })).toBe(expected);
});

test("payload comparison does not assign path membership", () => {
  expect(compareDistributionFile({ path: "old", bytes: new Uint8Array([0, 255]), mode: 0o644 }, { path: "new", bytes: new Uint8Array([0, 255]), mode: 0o644 })).toBe("unchanged");
  expect(hostRootChanges({ files: [{ path: "old", bytes: new Uint8Array([0, 255]), mode: 0o644 }], directories: [] }, { files: [{ path: "new", bytes: new Uint8Array([0, 255]), mode: 0o644 }], directories: [] })).toEqual({ added: ["new"], replaced: [], removed: ["old"], directoriesAdded: [], directoriesChanged: [], directoriesRemoved: [] });
});

test("empty roots have no amendments", () => {
  expect(hostRootChanges(empty, empty)).toEqual({ added: [], replaced: [], removed: [], directoriesAdded: [], directoriesChanged: [], directoriesRemoved: [] });
});

test("each amendment category is independently sorted and payload changes replace", () => {
  const before: DistributionRoot = { files: [
    { path: "z-removed", bytes: new Uint8Array([7]), mode: 0o644 },
    { path: "content", bytes: new Uint8Array([0, 255]), mode: 0o644 },
    { path: "mode", bytes: new Uint8Array([8]), mode: 0o644 },
    { path: "stable", bytes: new Uint8Array([9]), mode: 0o644 },
    { path: "a-removed", bytes: new Uint8Array([6]), mode: 0o644 },
  ], directories: [{ path: "z-retired", mode: 0o755 }, { path: "z-mode", mode: 0o755 }, { path: "a-mode", mode: 0o755 }, { path: "a-retired", mode: 0o755 }] };
  const after: DistributionRoot = { files: [
    { path: "z-added", bytes: new Uint8Array([5]), mode: 0o644 },
    { path: "mode", bytes: new Uint8Array([8]), mode: 0o755 },
    { path: "stable", bytes: new Uint8Array([9]), mode: 0o644 },
    { path: "content", bytes: new Uint8Array([0, 254]), mode: 0o644 },
    { path: "a-added", bytes: new Uint8Array([4]), mode: 0o644 },
  ], directories: [{ path: "z-new", mode: 0o755 }, { path: "z-mode", mode: 0o700 }, { path: "a-mode", mode: 0o777 }, { path: "a-new", mode: 0o755 }] };
  expect(hostRootChanges(before, after)).toEqual({ added: ["a-added", "z-added"], replaced: ["content", "mode"], removed: ["a-removed", "z-removed"], directoriesAdded: ["a-new", "z-new"], directoriesChanged: ["a-mode", "z-mode"], directoriesRemoved: ["a-retired", "z-retired"] });
});

test("root membership remains case-sensitive even when the payload is unchanged", () => {
  expect(hostRootChanges({ files: [{ path: "Asset", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "Empty", mode: 0o755 }] }, { files: [{ path: "asset", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "empty", mode: 0o755 }] })).toEqual({ added: ["asset"], replaced: [], removed: ["Asset"], directoriesAdded: ["empty"], directoriesChanged: [], directoriesRemoved: ["Empty"] });
});

test("inventory order is not a payload or directory-mode change", () => {
  expect(hostRootChanges({ files: [{ path: "z", bytes: new Uint8Array([0]), mode: 0o644 }, { path: "a", bytes: new Uint8Array([255]), mode: 0o755 }], directories: [{ path: "z-dir", mode: 0o755 }, { path: "a-dir", mode: 0o700 }] }, { files: [{ path: "a", bytes: new Uint8Array([255]), mode: 0o755 }, { path: "z", bytes: new Uint8Array([0]), mode: 0o644 }], directories: [{ path: "a-dir", mode: 0o700 }, { path: "z-dir", mode: 0o755 }] })).toEqual({ added: [], replaced: [], removed: [], directoriesAdded: [], directoriesChanged: [], directoriesRemoved: [] });
});

test("accepted roots retain the original root, binary storage, inputs and diagnostics", () => {
  const prepared: PreparedHostRoot = { files: [{ path: "tree/deep/asset", bytes: new Uint8Array([0, 255, 128]), mode: 0o777 }], directories: [{ path: "tree/deep", mode: 0 }, { path: "tree", mode: 0o777 }, { path: "empty", mode: 0o755 }], ...unchanged, added: ["tree/deep/asset"], directoriesAdded: ["empty", "tree", "tree/deep"], inputs: [{ path: "harness/example/manifest.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }], diagnostics: { stdout: "emitted\n", stderr: "warning\n" } };
  const admission = { value: undefined, ...admitPreparedHostRoot(empty, prepared) };
  expect(admission.status).toBe("ok");
  expect(admission.value).toBe(prepared);
  expect(admission.value?.files).toBe(prepared.files);
  expect(admission.value?.files[0]?.bytes).toBe(prepared.files[0]?.bytes);
  expect(admission.value?.inputs).toBe(prepared.inputs);
  expect(admission.value?.diagnostics).toBe(prepared.diagnostics);
});

test("empty roots and zero-mode root files are valid without invented parents", () => {
  expect(admitPreparedHostRoot(empty, { ...empty, ...unchanged, inputs: [] })).toEqual({ status: "ok", value: { files: [], directories: [], added: [], replaced: [], removed: [], directoriesAdded: [], directoriesChanged: [], directoriesRemoved: [], inputs: [] } });
  expect(admitPreparedHostRoot(empty, { files: [{ path: "asset", bytes: new Uint8Array(), mode: 0 }], directories: [], ...unchanged, added: ["asset"], inputs: [] })).toEqual({ status: "ok", value: { files: [{ path: "asset", bytes: new Uint8Array(), mode: 0 }], directories: [], added: ["asset"], replaced: [], removed: [], directoriesAdded: [], directoriesChanged: [], directoriesRemoved: [], inputs: [] } });
});

test.each(["", ".", "..", "C:escape", "back\\slash", "bad\u0000name"])("admission refuses unsafe file path %s", path => {
  expect(admitPreparedHostRoot(empty, { files: [{ path, bytes: new Uint8Array([1]), mode: 0o644 }], directories: [], ...unchanged, added: [path], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: path, detail: "prepared host files require safe paths and explicit permission modes" }] });
});

test.each([-1, 0o1000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("admission refuses invalid file mode %s", mode => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "asset", bytes: new Uint8Array([1]), mode }], directories: [], ...unchanged, added: ["asset"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "asset", detail: "prepared host files require safe paths and explicit permission modes" }] });
});

test.each(["", ".", "..", "C:escape", "back\\slash", "bad\u001fname"])("admission uses real directory path checks for %s", path => {
  expect(admitPreparedHostRoot(empty, { files: [], directories: [{ path, mode: 0o755 }], ...unchanged, directoriesAdded: [path], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: path, detail: "distribution directories require safe relative paths" }] });
});

test.each([-1, 0o1000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("admission refuses invalid directory mode %s", mode => {
  expect(admitPreparedHostRoot(empty, { files: [], directories: [{ path: "tree", mode }], ...unchanged, directoriesAdded: ["tree"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree", detail: "distribution directories require permission modes between 0 and 0777" }] });
});

test.each([
  { first: "asset", second: "asset", added: ["asset", "asset"] },
  { first: "asset", second: "Asset", added: ["Asset", "asset"] },
])("duplicate and case-alias file paths cannot be admitted: $first, $second", ({ first, second, added }) => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: first, bytes: new Uint8Array([1]), mode: 0o644 }, { path: second, bytes: new Uint8Array([2]), mode: 0o644 }], directories: [], ...unchanged, added, inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "host-emission", detail: "prepared host paths cannot be duplicated or differ only by case" }] });
});

test("duplicate directories retain both the directory and root collision findings", () => {
  expect(admitPreparedHostRoot(empty, { files: [], directories: [{ path: "tree", mode: 0o755 }, { path: "tree", mode: 0o755 }], ...unchanged, directoriesAdded: ["tree", "tree"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "tree", detail: "distribution directories must be unique and cannot occupy native file paths" }, { code: "destination-collision", subject: "host-emission", detail: "prepared host paths cannot be duplicated or differ only by case" }] });
});

test("case-alias directories cannot be admitted", () => {
  expect(admitPreparedHostRoot(empty, { files: [], directories: [{ path: "tree", mode: 0o755 }, { path: "Tree", mode: 0o755 }], ...unchanged, directoriesAdded: ["Tree", "tree"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "host-emission", detail: "prepared host paths cannot be duplicated or differ only by case" }] });
});

test("a file and directory cannot occupy the same path", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "tree", mode: 0o755 }], ...unchanged, added: ["tree"], directoriesAdded: ["tree"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "tree", detail: "distribution directories must be unique and cannot occupy native file paths" }, { code: "destination-collision", subject: "host-emission", detail: "prepared host paths cannot be duplicated or differ only by case" }] });
});

test("a file and directory cannot occupy case-alias paths", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "Tree", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "tree", mode: 0o755 }], ...unchanged, added: ["Tree"], directoriesAdded: ["tree"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "host-emission", detail: "prepared host paths cannot be duplicated or differ only by case" }] });
});

test("all missing ancestors are reported in root-to-leaf order", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree/deep/asset", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [], ...unchanged, added: ["tree/deep/asset"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree", detail: "prepared host roots require every actual parent directory" }, { code: "invalid-input", subject: "tree/deep", detail: "prepared host roots require every actual parent directory" }] });
});

test("an existing ancestor does not stand in for the immediate parent", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree/deep/asset", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "tree", mode: 0o755 }], ...unchanged, added: ["tree/deep/asset"], directoriesAdded: ["tree"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree/deep", detail: "prepared host roots require every actual parent directory" }] });
});

test("an empty nested directory also needs its actual parent", () => {
  expect(admitPreparedHostRoot(empty, { files: [], directories: [{ path: "tree/deep", mode: 0o755 }], ...unchanged, directoriesAdded: ["tree/deep"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree", detail: "prepared host roots require every actual parent directory" }] });
});

test("a differently cased directory is not the actual parent", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree/asset", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "TREE", mode: 0o755 }], ...unchanged, added: ["tree/asset"], directoriesAdded: ["TREE"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree", detail: "prepared host roots require every actual parent directory" }] });
});

test("a file cannot stand in for a directory parent", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree", bytes: new Uint8Array([1]), mode: 0o644 }, { path: "tree/asset", bytes: new Uint8Array([2]), mode: 0o644 }], directories: [], ...unchanged, added: ["tree", "tree/asset"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree", detail: "prepared host roots require every actual parent directory" }] });
});

test("a directory below a file preserves collision then parent findings", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "tree/deep", mode: 0o755 }], ...unchanged, added: ["tree"], directoriesAdded: ["tree/deep"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "tree/deep", detail: "distribution directories must be unique and cannot occupy native file paths" }, { code: "invalid-input", subject: "tree", detail: "prepared host roots require every actual parent directory" }] });
});

test("shared missing parents keep one finding per observed entry", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree/a", bytes: new Uint8Array([1]), mode: 0o644 }, { path: "tree/b", bytes: new Uint8Array([2]), mode: 0o644 }], directories: [], ...unchanged, added: ["tree/a", "tree/b"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree", detail: "prepared host roots require every actual parent directory" }, { code: "invalid-input", subject: "tree", detail: "prepared host roots require every actual parent directory" }] });
});

test("unsafe path components are rejected without silently normalizing them", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "tree/../asset", bytes: new Uint8Array([1]), mode: 0o644 }], directories: [{ path: "tree", mode: 0o755 }], ...unchanged, added: ["tree/../asset"], directoriesAdded: ["tree"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "tree/../asset", detail: "prepared host files require safe paths and explicit permission modes" }, { code: "invalid-input", subject: "tree/..", detail: "prepared host roots require every actual parent directory" }] });
});

const declarations = [
  { amendment: { added: ["invented"] }, subject: "added" },
  { amendment: { replaced: ["invented"] }, subject: "replaced" },
  { amendment: { removed: ["invented"] }, subject: "removed" },
  { amendment: { directoriesAdded: ["invented"] }, subject: "directoriesAdded" },
  { amendment: { directoriesChanged: ["invented"] }, subject: "directoriesChanged" },
  { amendment: { directoriesRemoved: ["invented"] }, subject: "directoriesRemoved" },
];
test.each(declarations)("admission independently rejects invented $subject declarations", ({ amendment, subject }) => {
  expect(admitPreparedHostRoot(empty, { ...empty, ...unchanged, ...amendment, inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject, detail: "host amendment declarations must agree with independently compared before and after bytes and modes" }] });
});

test("declared additions must use the canonical order rather than inventory order", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "z", bytes: new Uint8Array(), mode: 0o644 }, { path: "a", bytes: new Uint8Array(), mode: 0o644 }], directories: [], ...unchanged, added: ["z", "a"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "added", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" }] });
});

test("duplicate declarations are not treated as a set", () => {
  expect(admitPreparedHostRoot(empty, { files: [{ path: "asset", bytes: new Uint8Array(), mode: 0o644 }], directories: [], ...unchanged, added: ["asset", "asset"], inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "added", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" }] });
});

test.each([
  { bytes: new Uint8Array([0, 254]), mode: 0o644 },
  { bytes: new Uint8Array([0, 255]), mode: 0o755 },
  { bytes: new Uint8Array([0, 254]), mode: 0o755 },
])("actual byte or mode changes cannot be declared unchanged: %s", ({ bytes, mode }) => {
  expect(admitPreparedHostRoot({ files: [{ path: "asset", bytes: new Uint8Array([0, 255]), mode: 0o644 }], directories: [] }, { files: [{ path: "asset", bytes, mode }], directories: [], ...unchanged, inputs: [] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "replaced", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" }] });
});

test("amendment refusals retain the six-category declaration order", () => {
  expect(admitPreparedHostRoot({ files: [{ path: "removed", bytes: new Uint8Array([1]), mode: 0o644 }, { path: "replaced", bytes: new Uint8Array([2]), mode: 0o644 }], directories: [{ path: "removed-dir", mode: 0o755 }, { path: "changed-dir", mode: 0o755 }] }, { files: [{ path: "added", bytes: new Uint8Array([3]), mode: 0o644 }, { path: "replaced", bytes: new Uint8Array([4]), mode: 0o644 }], directories: [{ path: "added-dir", mode: 0o755 }, { path: "changed-dir", mode: 0o700 }], ...unchanged, inputs: [] })).toEqual({ status: "invalid", findings: [
    { code: "foreign-content", subject: "added", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" },
    { code: "foreign-content", subject: "replaced", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" },
    { code: "foreign-content", subject: "removed", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" },
    { code: "foreign-content", subject: "directoriesAdded", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" },
    { code: "foreign-content", subject: "directoriesChanged", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" },
    { code: "foreign-content", subject: "directoriesRemoved", detail: "host amendment declarations must agree with independently compared before and after bytes and modes" },
  ] });
});

test("comparison and admission do not mutate frozen inventories or their binary content", () => {
  const before: DistributionRoot = Object.freeze({ files: Object.freeze([{ path: "z", bytes: new Uint8Array([0, 255]), mode: 0o644 }, { path: "a", bytes: new Uint8Array([128]), mode: 0o644 }]), directories: Object.freeze([{ path: "z-dir", mode: 0o755 }, { path: "a-dir", mode: 0o755 }]) });
  const prepared: PreparedHostRoot = Object.freeze({ files: Object.freeze([{ path: "z", bytes: new Uint8Array([0, 254]), mode: 0o644 }, { path: "a", bytes: new Uint8Array([128]), mode: 0o755 }]), directories: Object.freeze([{ path: "z-dir", mode: 0o700 }, { path: "a-dir", mode: 0o755 }]), ...unchanged, replaced: Object.freeze(["a", "z"]), directoriesChanged: Object.freeze(["z-dir"]), inputs: Object.freeze([]) });
  expect(hostRootChanges(before, prepared)).toEqual({ added: [], replaced: ["a", "z"], removed: [], directoriesAdded: [], directoriesChanged: ["z-dir"], directoriesRemoved: [] });
  const admission = { value: undefined, ...admitPreparedHostRoot(before, prepared) };
  expect(admission.status).toBe("ok");
  expect(admission.value).toBe(prepared);
  expect(before).toEqual({ files: [{ path: "z", bytes: new Uint8Array([0, 255]), mode: 0o644 }, { path: "a", bytes: new Uint8Array([128]), mode: 0o644 }], directories: [{ path: "z-dir", mode: 0o755 }, { path: "a-dir", mode: 0o755 }] });
  expect(prepared).toEqual({ files: [{ path: "z", bytes: new Uint8Array([0, 254]), mode: 0o644 }, { path: "a", bytes: new Uint8Array([128]), mode: 0o755 }], directories: [{ path: "z-dir", mode: 0o700 }, { path: "a-dir", mode: 0o755 }], added: [], replaced: ["a", "z"], removed: [], directoriesAdded: [], directoriesChanged: ["z-dir"], directoriesRemoved: [], inputs: [] });
});

test("declared file and directory removals admit the exact empty replacement root", () => {
  const prepared: PreparedHostRoot = { files: [], directories: [], ...unchanged, removed: ["tree/asset"], directoriesRemoved: ["tree"], inputs: [] };
  const admission = { value: undefined, ...admitPreparedHostRoot({ files: [{ path: "tree/asset", bytes: new Uint8Array([0, 255]), mode: 0o644 }], directories: [{ path: "tree", mode: 0o755 }] }, prepared) };
  expect(admission.status).toBe("ok");
  expect(admission.value).toBe(prepared);
});
