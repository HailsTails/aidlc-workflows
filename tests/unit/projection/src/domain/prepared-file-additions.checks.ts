import { expect, mock, test } from "bun:test";
import { planPreparedFileAdditions, type PreparedFileAdditionServices } from "../../../../../scripts/projection/src/domain/prepared-file-additions.ts";
import { preparedCandidate } from "../../support/__tests__/prepared-runner-fixtures.ts";
import { methodFailure } from "../../support/__tests__/method-fixtures.ts";
const createServices = (): PreparedFileAdditionServices => ({ collect: mock<PreparedFileAdditionServices["collect"]>().mockReturnValue({ status: "ok", value: [preparedCandidate] }), plan: mock<PreparedFileAdditionServices["plan"]>().mockReturnValue({ status: "ok", value: { additions: [], unchanged: ["preserved"] } }) });
test("collects native whole files and delegates encoded bytes to the runtime admission owner", () => {
  const services = createServices(), path = mock().mockReturnValue("safe"), encode = mock().mockReturnValue(new Uint8Array([7, 8]));
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [] }, mode: 0o644, rules: { path, encode }, services })).toEqual({ status: "ok", value: { additions: [], unchanged: ["preserved"] } });
  expect(services.collect).toHaveBeenCalledWith({ resources: [preparedCandidate] });
  expect(encode).toHaveBeenCalledWith({ text: "abc" });
  expect(services.plan).toHaveBeenCalledWith({ candidates: [{ path: ".claude/skills/aidlc-init/SKILL.md", bytes: new Uint8Array([7, 8]), mode: 0o644 }], inventory: { files: [], directories: [] }, rules: { path, encode } });
});
test("collection refusal suppresses byte encoding and admission", () => {
  const services = { ...createServices(), collect: mock<PreparedFileAdditionServices["collect"]>().mockReturnValue(methodFailure) }, encode = mock();
  expect(planPreparedFileAdditions({ candidates: [{ ...preparedCandidate, kind: "registration" }], inventory: { files: [], directories: [] }, mode: 0o644, rules: { path: mock(), encode }, services })).toEqual(methodFailure);
  expect(services.collect).toHaveBeenCalledWith({ resources: [{ ...preparedCandidate, kind: "registration" }] });
  expect(encode).not.toHaveBeenCalled();
  expect(services.plan).not.toHaveBeenCalled();
});
test("invalid permission mode suppresses encoding and byte admission", () => {
  const services = createServices(), encode = mock();
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [] }, mode: -1, rules: { path: mock(), encode }, services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-runner-mode", detail: "new prepared files require a permission mode between 0 and 0777" }] });
  expect(encode).not.toHaveBeenCalled();
  expect(services.plan).not.toHaveBeenCalled();
});
test("byte admission refusal is returned without reinterpreting it as text policy", () => {
  const services = { ...createServices(), plan: mock<PreparedFileAdditionServices["plan"]>().mockReturnValue(methodFailure) }, path = mock().mockReturnValue("safe"), encode = mock().mockReturnValue(new Uint8Array([7, 8]));
  expect(planPreparedFileAdditions({ candidates: [preparedCandidate], inventory: { files: [], directories: [] }, mode: 0o644, rules: { path, encode }, services })).toEqual(methodFailure);
  expect(services.plan).toHaveBeenCalledWith({ candidates: [{ path: ".claude/skills/aidlc-init/SKILL.md", bytes: new Uint8Array([7, 8]), mode: 0o644 }], inventory: { files: [], directories: [] }, rules: { path, encode } });
});
