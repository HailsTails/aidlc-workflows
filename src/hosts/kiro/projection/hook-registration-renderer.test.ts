import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { createKiroHookRegistrations, KIRO_HOOK_REGISTRATION_INPUTS } from "./hook-registration-renderer.ts";

const human = { source: source("hooks/aidlc-record-human-turn.kiro.hook"),
  content: { kind: "text" as const, text: '{"command":"{{INVOKE}} engine hook record-human-turn"}\n' } };
const guard = { source: source("hooks/aidlc-plan-approval-guard.kiro.hook"),
  content: { kind: "text" as const, text: '{"command":"{{INVOKE}} engine adapter kiro plan-approval-guard"}\n' } };
const preparedHuman = { ...human, content: { kind: "text" as const,
  text: '{"command":"bun .kiro/tools/aidlc.ts engine hook record-human-turn"}\n' } };
const preparedGuard = { ...guard, content: { kind: "text" as const,
  text: '{"command":"bun .kiro/tools/aidlc.ts engine adapter kiro plan-approval-guard"}\n' } };
const inputs = settingsRenderingInputsFixture({ harnessDir: ".kiro", files: [human, guard] });
const expected = accepted([
  { path: path(".kiro/hooks/aidlc-record-human-turn.kiro.hook"),
    content: { kind: "text" as const,
      text: '{"command":"bun .kiro/tools/aidlc.ts engine hook record-human-turn"}\n' },
    mode: "regular" as const,
    origin: { kind: "harness-authored" as const, source: source("hooks/aidlc-record-human-turn.kiro.hook") } },
  { path: path(".kiro/hooks/aidlc-plan-approval-guard.kiro.hook"),
    content: { kind: "text" as const,
      text: '{"command":"bun .kiro/tools/aidlc.ts engine adapter kiro plan-approval-guard"}\n' },
    mode: "regular" as const,
    origin: { kind: "harness-authored" as const, source: source("hooks/aidlc-plan-approval-guard.kiro.hook") } },
]);

test("only the two shipped registrations are captured", () => {
  expect(KIRO_HOOK_REGISTRATION_INPUTS).toEqual([
    "hooks/aidlc-record-human-turn.kiro.hook", "hooks/aidlc-plan-approval-guard.kiro.hook",
  ]);
});

test("prepared hook registrations are placed once without the agent command suffix", () => {
  const prepare = mock().mockReturnValueOnce(accepted(preparedHuman)).mockReturnValueOnce(accepted(preparedGuard));
  expect(createKiroHookRegistrations({ ...inputs, prepare })({ hooks: [] })).toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(prepare).toHaveBeenNthCalledWith(1, human);
  expect(prepare).toHaveBeenNthCalledWith(2, guard);
});

test("other authored hooks are not shipped and capture order does not change placement order", () => {
  const prepare = mock().mockReturnValueOnce(accepted(preparedHuman)).mockReturnValueOnce(accepted(preparedGuard));
  expect(createKiroHookRegistrations({ ...inputs, prepare, files: [guard,
    { source: source("hooks/aidlc-session-start.kiro.hook"), content: { kind: "text", text: "not shipped" } }, human],
  })({ hooks: [] })).toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(prepare).toHaveBeenNthCalledWith(1, human);
  expect(prepare).toHaveBeenNthCalledWith(2, guard);
});

test("a missing human-turn registration is a typed refusal", () => {
  expect(createKiroHookRegistrations({ ...inputs, files: [guard],
    prepare: mock().mockReturnValue(accepted(preparedGuard)),
  })({ hooks: [] })).toEqual(refused({ kind: "render-failed", concept: "hook-registration",
    name: "hooks/aidlc-record-human-turn.kiro.hook",
    reason: "The authored Kiro hook registration was not captured." }));
});

test("a missing approval guard is a typed refusal", () => {
  expect(createKiroHookRegistrations({ ...inputs, files: [human],
    prepare: mock().mockReturnValue(accepted(preparedHuman)),
  })({ hooks: [] })).toEqual(refused({ kind: "render-failed", concept: "hook-registration",
    name: "hooks/aidlc-plan-approval-guard.kiro.hook",
    reason: "The authored Kiro hook registration was not captured." }));
});

test("a preparation refusal retains its exact source and reason", () => {
  const failure = refused({ kind: "render-failed" as const, concept: "hook-registration" as const,
    name: "hooks/aidlc-record-human-turn.kiro.hook", reason: "Captured content could not be prepared." });
  const prepare = mock().mockReturnValueOnce(failure).mockReturnValueOnce(accepted(preparedGuard));
  expect(createKiroHookRegistrations({ ...inputs, prepare })({ hooks: [] })).toEqual(failure);
});

test("prepared bytes retain their encoding and are not parsed or normalized", () => {
  const prepare = mock().mockReturnValueOnce(accepted({ ...human,
    content: { kind: "bytes", bytes: new Uint8Array([239, 187, 191, 123, 125, 13, 10]) },
  })).mockReturnValueOnce(accepted(preparedGuard));
  expect(createKiroHookRegistrations({ ...inputs, prepare })({ hooks: [] })).toEqual(accepted([
    { path: path(".kiro/hooks/aidlc-record-human-turn.kiro.hook"),
      content: { kind: "bytes", bytes: new Uint8Array([239, 187, 191, 123, 125, 13, 10]) },
      mode: "regular",
      origin: { kind: "harness-authored", source: source("hooks/aidlc-record-human-turn.kiro.hook") } },
    { path: path(".kiro/hooks/aidlc-plan-approval-guard.kiro.hook"),
      content: { kind: "text", text: '{"command":"bun .kiro/tools/aidlc.ts engine adapter kiro plan-approval-guard"}\n' },
      mode: "regular",
      origin: { kind: "harness-authored", source: source("hooks/aidlc-plan-approval-guard.kiro.hook") } },
  ]));
});
