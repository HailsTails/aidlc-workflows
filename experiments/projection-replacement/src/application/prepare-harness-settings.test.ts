import { expect, mock, test } from "bun:test";
import { prepareHarnessSettings, type HarnessSettingsPreparationRequest } from "./prepare-harness-settings.ts";
import { entryBasis } from "../../__tests__/harness-document-fixtures.ts";

const dispatcher = { path: ".claude/tools/aidlc.ts", bytes: new Uint8Array([68]), mode: 0o644 };
const settings = { path: ".claude/settings.json", bytes: new Uint8Array([83]), mode: 0o644 };
const evidence = { kind: "runtime-modules", paths: [".claude/tools/aidlc.ts"], inputs: [] } as const;
const prepared = { files: [settings], preparation: { kind: "harness-settings", paths: [".claude/settings.json"], inputs: [] } } as const;
const request: HarnessSettingsPreparationRequest = { sourceRoot: "source", root: "scratch", mode: 0o644, seed: { basis: entryBasis, binding: { harness: "claude", directory: ".claude" }, invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", files: [dispatcher], directories: [], inputPreparations: [evidence] } };
const fixture = () => ({ preparer: { prepare: mock().mockResolvedValue({ status: "ok", value: prepared }) }, admit: mock().mockReturnValue({ status: "ok", value: { additions: [settings], unchanged: [] } }), rules: { path: mock().mockReturnValue("safe") } });

test("settings prepare against delivered runtime paths, then admit bytes before retaining evidence", async () => {
  const services = fixture();
  expect(await prepareHarnessSettings({ request, services })).toEqual({ status: "ok", value: { ...request.seed, files: [dispatcher, settings], inputPreparations: [evidence, prepared.preparation] } });
  expect(services.preparer.prepare).toHaveBeenCalledWith({ sourceRoot: "source", root: "scratch", basis: entryBasis, binding: { harness: "claude", directory: ".claude" }, invocation: "bun .claude/tools/aidlc.ts", mode: 0o644, files: [".claude/tools/aidlc.ts"] });
  expect(services.admit).toHaveBeenCalledWith({ candidates: [settings], inventory: request.seed, rules: services.rules });
});
test("merely supplying a dispatcher does not establish source-prepared settings authority", async () => {
  const services = fixture();
  expect(await prepareHarnessSettings({ request: { ...request, seed: { ...request.seed, inputPreparations: [] } }, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-settings", detail: "copy-channel settings require the Claude source-prepared runtime dispatcher; permissions are not inferred from arbitrary files" }] });
  expect(services.preparer.prepare).not.toHaveBeenCalled();
  expect(services.admit).not.toHaveBeenCalled();
});
test("a different harness cannot borrow Claude settings authority", async () => {
  const services = fixture();
  expect(await prepareHarnessSettings({ request: { ...request, seed: { ...request.seed, binding: { harness: "cursor", directory: ".cursor" } } }, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-settings", detail: "copy-channel settings require the Claude source-prepared runtime dispatcher; permissions are not inferred from arbitrary files" }] });
  expect(services.preparer.prepare).not.toHaveBeenCalled();
});
test("native refusal prevents byte admission", async () => {
  const services = { ...fixture(), preparer: { prepare: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "settings", detail: "missing authored permission marker" }] }) } };
  expect(await prepareHarnessSettings({ request, services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "settings", detail: "missing authored permission marker" }] });
  expect(services.admit).not.toHaveBeenCalled();
});
test("user-modified supplied settings remain an explicit conflict", async () => {
  const services = { ...fixture(), admit: mock().mockReturnValue({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/settings.json", detail: "retain user bytes" }] }) };
  expect(await prepareHarnessSettings({ request, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/settings.json", detail: "retain user bytes" }] });
});
test("matching supplied settings keep their existing mode without adding duplicate files", async () => {
  const seed = { ...request.seed, files: [dispatcher, { ...settings, mode: 0o600 }] };
  const services = { ...fixture(), admit: mock().mockReturnValue({ status: "ok", value: { additions: [], unchanged: [".claude/settings.json"] } }) };
  expect(await prepareHarnessSettings({ request: { ...request, seed }, services })).toEqual({ status: "ok", value: { ...seed, inputPreparations: [evidence, prepared.preparation] } });
});
