import { expect, mock, test } from "bun:test";
import { planPreparedRuntimeFiles } from "./prepared-runtime-files.ts";
import { preparedExistingFile } from "../../../../tests/unit/projection/support/__tests__/prepared-runner-fixtures.ts";
test("admits opaque bytes without text decoding or projection ownership", () => {
  const path = mock().mockReturnValue("safe");
  expect(planPreparedRuntimeFiles({ candidates: [{ path: "memory/.gitkeep", bytes: new Uint8Array([255, 10]), mode: 0o644 }], inventory: { files: [], directories: [] }, rules: { path } })).toEqual({ status: "ok", value: { additions: [{ path: "memory/.gitkeep", bytes: new Uint8Array([255, 10]), mode: 0o644 }], unchanged: [] } });
  expect(path).toHaveBeenCalledWith({ path: "memory/.gitkeep" });
});
test("matching bytes preserve the existing file and its mode", () => {
  expect(planPreparedRuntimeFiles({ candidates: [{ ...preparedExistingFile, mode: 0o666 }], inventory: { files: [preparedExistingFile], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "ok", value: { additions: [], unchanged: [".claude/skills/aidlc-init/SKILL.md"] } });
});
test("changed existing bytes refuse implicit replacement", () => {
  expect(planPreparedRuntimeFiles({ candidates: [preparedExistingFile], inventory: { files: [{ ...preparedExistingFile, bytes: new Uint8Array([255]) }], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "existing prepared file differs from the candidate; preserve it or prepare a fresh staging tree" }] });
});
test("duplicate candidates cannot hide differing byte records", () => {
  expect(planPreparedRuntimeFiles({ candidates: [preparedExistingFile, { ...preparedExistingFile, bytes: new Uint8Array([255]) }], inventory: { files: [], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "prepared-runtime-candidates", detail: "prepared byte candidates must have one record per destination" }] });
});
test("duplicate existing paths cannot hide modified bytes", () => {
  expect(planPreparedRuntimeFiles({ candidates: [preparedExistingFile], inventory: { files: [preparedExistingFile, { ...preparedExistingFile, bytes: new Uint8Array([255]) }], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "prepared-runner-inventory", detail: "existing prepared files must have one byte record per path" }] });
});
test("unsafe destinations are refused before admission", () => {
  expect(planPreparedRuntimeFiles({ candidates: [preparedExistingFile], inventory: { files: [], directories: [] }, rules: { path: mock().mockReturnValue("unsafe") } })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions require safe relative destinations" }] });
});
test("invalid byte-file permission modes refuse the collection", () => {
  expect(planPreparedRuntimeFiles({ candidates: [{ ...preparedExistingFile, mode: 0o1000 }], inventory: { files: [], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-runtime-mode", detail: "prepared byte files require permission modes between 0 and 0777" }] });
});
test("an empty directory blocks its implicit parent file", () => {
  expect(planPreparedRuntimeFiles({ candidates: [preparedExistingFile], inventory: { files: [], directories: [{ path: ".claude/skills/aidlc-init/SKILL.md/empty" }] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions must have unique file destinations without file/directory overlaps" }] });
});
test("an existing file blocks a nested byte candidate", () => {
  expect(planPreparedRuntimeFiles({ candidates: [preparedExistingFile], inventory: { files: [{ ...preparedExistingFile, path: ".claude/skills" }], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions must have unique file destinations without file/directory overlaps" }] });
});
test("a native directory cannot become a prepared byte file", () => {
  expect(planPreparedRuntimeFiles({ candidates: [preparedExistingFile], inventory: { files: [], directories: [{ path: ".claude/skills/aidlc-init/SKILL.md" }] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions must have unique file destinations without file/directory overlaps" }] });
});
test("similarly named files are distinct destinations rather than a parent collision", () => {
  expect(planPreparedRuntimeFiles({ candidates: [{ path: "memory/org.md.backup", bytes: new Uint8Array([255]), mode: 0o644 }], inventory: { files: [{ path: "memory/org.md", bytes: new Uint8Array([1]), mode: 0o600 }], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "ok", value: { additions: [{ path: "memory/org.md.backup", bytes: new Uint8Array([255]), mode: 0o644 }], unchanged: [] } });
});
test("one candidate cannot become the parent of another candidate", () => {
  expect(planPreparedRuntimeFiles({ candidates: [{ path: "memory", bytes: new Uint8Array([1]), mode: 0o644 }, { path: "memory/org.md", bytes: new Uint8Array([2]), mode: 0o644 }], inventory: { files: [], directories: [] }, rules: { path: mock().mockReturnValue("safe") } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "memory", detail: "prepared additions must have unique file destinations without file/directory overlaps" }, { code: "destination-collision", subject: "memory/org.md", detail: "prepared additions must have unique file destinations without file/directory overlaps" }] });
});
