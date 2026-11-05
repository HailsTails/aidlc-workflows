import { expect, mock, test } from "bun:test";
import { planPreparedFileAdditions } from "./prepared-file-additions.ts";
import { preparedCandidate, preparedExistingFile, createPreparedAdditionRules } from "../../__tests__/prepared-runner-fixtures.ts";
test("plans only an absent candidate without installation ownership", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "ok", value: { additions: [{ path: ".claude/skills/aidlc-init/SKILL.md", bytes: new Uint8Array([97, 98, 99]), mode: 0o644 }], unchanged: [] } });
});
test("equal existing bytes remain untouched with their existing permission mode", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [preparedExistingFile], directories: [] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "ok", value: { additions: [], unchanged: [".claude/skills/aidlc-init/SKILL.md"] } });
});
test("a changed existing file cannot become an implicit replacement", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [{ ...preparedExistingFile, bytes: new Uint8Array([97]) }], directories: [] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "existing prepared file differs from the candidate; preserve it or prepare a fresh staging tree" }] });
});
test("duplicate candidates cannot overwrite an absent destination", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate, preparedCandidate], inventory: { files: [], directories: [] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "native file set must emit each destination once" }] });
});
test("registration fragments cannot be reclassified as missing whole files", () => {
  expect(planPreparedFileAdditions({ candidates: [{ ...preparedCandidate, kind: "registration" }], inventory: { files: [], directories: [] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "native file sets require assembled files; registration fragments must be reconciled by their owner first" }] });
});
test("an existing directory cannot be replaced by a generated file", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [{ path: ".claude/skills/aidlc-init/SKILL.md" }] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions must have unique file destinations without file/directory overlaps" }] });
});
test("an empty descendant directory still blocks its implicit parent file", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [{ path: ".claude/skills/aidlc-init/SKILL.md/cache" }] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions must have unique file destinations without file/directory overlaps" }] });
});
test("a duplicate current file record cannot hide changed bytes behind an equal first match", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [preparedExistingFile, { ...preparedExistingFile, bytes: new Uint8Array([97]) }], directories: [] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "prepared-runner-inventory", detail: "existing prepared files must have one byte record per path" }] });
});
test("a parent file blocks nested additions", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [{ ...preparedExistingFile, path: ".claude/skills" }], directories: [] }, mode: 0o644, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions must have unique file destinations without file/directory overlaps" }] });
});
test("unsafe candidate paths are refused even without existing files", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [] }, mode: 0o644, rules: { ...createPreparedAdditionRules(), path: mock().mockReturnValue("unsafe") } })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "prepared additions require safe relative destinations" }] });
});
test("invalid permission modes cannot reach a new prepared file", () => {
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [] }, mode: -1, rules: createPreparedAdditionRules() })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-runner-mode", detail: "new prepared files require a permission mode between 0 and 0777" }] });
});
