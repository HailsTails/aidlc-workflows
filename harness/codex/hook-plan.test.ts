import { expect, test } from "bun:test";
import { codexHookTrustHash } from "../../core/tools/aidlc-command.ts";
import { emitHooksJson, hookTrustState, resolveCodexHookPlan } from "./hook-plan.ts";
import pinned from "./fixtures/settings93a.json";

const binding = { harnessDir: ".codex", harnessName: "codex", invoke: "aidlc", trustedNamespace: "engine" };

test("the ordered plan retains all eleven independently recorded hooks", () => {
  expect(emitHooksJson(resolveCodexHookPlan({ binding }))).toBe(pinned.cases[0]!.hooksJson);
});

test("an additional event and repeated matcher resolve once for both serializers", () => {
  const plan = resolveCodexHookPlan({ binding, registrations: [
    { event: "PermissionRequest", groups: [{ target: "validate-state", matcher: "Bash" }, { target: "continue-workflow", matcher: "Bash" }, { target: "audit-and-sensors", matcher: "" }] },
    { event: "SessionStart", groups: [{ target: "changed-session-start" }] },
  ] });
  expect(plan).toEqual([
    { event: "PermissionRequest", identity: "permission_request", groups: [
      { index: 0, command: "aidlc engine adapter codex validate-state", timeout: 1800, matcher: "Bash" },
      { index: 1, command: "aidlc engine adapter codex continue-workflow", timeout: 3600, matcher: "Bash" },
      { index: 2, command: "aidlc engine adapter codex audit-and-sensors", timeout: 3600 },
    ] },
    { event: "SessionStart", identity: "session_start", groups: [{ index: 0, command: "aidlc engine adapter codex changed-session-start", timeout: 1800 }] },
  ]);
  expect(JSON.parse(emitHooksJson(plan))).toEqual(JSON.parse('{"hooks":{"PermissionRequest":[{"hooks":[{"type":"command","command":"aidlc engine adapter codex validate-state","timeout":1800}],"matcher":"Bash"},{"hooks":[{"type":"command","command":"aidlc engine adapter codex continue-workflow","timeout":3600}],"matcher":"Bash"},{"hooks":[{"type":"command","command":"aidlc engine adapter codex audit-and-sensors","timeout":3600}]}],"SessionStart":[{"hooks":[{"type":"command","command":"aidlc engine adapter codex changed-session-start","timeout":1800}]}]}}'));
  const state = hookTrustState({ plan, hooksJsonPath: "/project/.codex/hooks.json" });
  expect(state["/project/.codex/hooks.json:permission_request:0:0"]?.["trusted_hash"]).toBe(codexHookTrustHash("permission_request", "aidlc engine adapter codex validate-state", 1800, "Bash"));
  expect(state["/project/.codex/hooks.json:permission_request:1:0"]?.["trusted_hash"]).toBe(codexHookTrustHash("permission_request", "aidlc engine adapter codex continue-workflow", 3600, "Bash"));
  expect(state["/project/.codex/hooks.json:permission_request:2:0"]?.["trusted_hash"]).toBe(codexHookTrustHash("permission_request", "aidlc engine adapter codex audit-and-sensors", 3600));
  expect(state["/project/.codex/hooks.json:session_start:0:0"]?.["trusted_hash"]).toBe(codexHookTrustHash("session_start", "aidlc engine adapter codex changed-session-start", 1800));
});

test("duplicate event declarations cannot overwrite hooks while leaving trust entries behind", () => {
  expect(() => resolveCodexHookPlan({ binding, registrations: [
    { event: "SessionStart", groups: [{ target: "session-start" }, { target: "validate-state" }] },
    { event: "SessionStart", groups: [{ target: "continue-workflow" }] },
  ] })).toThrow("Codex hook events must be unique");
});
