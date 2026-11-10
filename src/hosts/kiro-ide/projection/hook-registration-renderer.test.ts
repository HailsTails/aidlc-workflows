import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { createKiroIdeHookRegistrations } from "./hook-registration-renderer.ts";

const human = { source: source("hooks/aidlc-record-human-turn.json"),
  content: { kind: "text" as const, text: '{"version":1,"command":"{{INVOKE}} human"}\n' } };
const guard = { source: source("hooks/aidlc-guard-tool-call.json"),
  content: { kind: "text" as const, text: "guard" } };
const log = { source: source("hooks/aidlc-log-subagent.json"),
  content: { kind: "text" as const, text: "log" } };
const start = { source: source("hooks/aidlc-session-start.json"),
  content: { kind: "text" as const, text: "start" } };
const keepGoing = { source: source("hooks/aidlc-continue-workflow.json"),
  content: { kind: "text" as const, text: "continue" } };
const files = [human, guard, log, start, keepGoing];
const inputs = settingsRenderingInputsFixture({ harnessDir: ".kiro", files });

const prepared = { ...human, content: { kind: "text" as const,
  text: '{"version":1,"command":"aidlc human"}\n' } };
const expected = accepted([
  { path: path(".kiro/hooks/aidlc-record-human-turn.json"), content: prepared.content,
    mode: "regular" as const, availability: "always" as const,
    origin: { kind: "harness-authored" as const, source: human.source } },
  { path: path(".kiro/hooks/aidlc-guard-tool-call.json"), content: guard.content,
    mode: "regular" as const, availability: "always" as const,
    origin: { kind: "harness-authored" as const, source: guard.source } },
  { path: path(".kiro/hooks/aidlc-log-subagent.json"), content: log.content,
    mode: "regular" as const, availability: "always" as const,
    origin: { kind: "harness-authored" as const, source: log.source } },
  { path: path(".kiro/hooks/aidlc-session-start.json"), content: start.content,
    mode: "regular" as const, availability: "always" as const,
    origin: { kind: "harness-authored" as const, source: start.source } },
  { path: path(".kiro/hooks/aidlc-continue-workflow.json"), content: keepGoing.content,
    mode: "regular" as const, availability: "always" as const,
    origin: { kind: "harness-authored" as const, source: keepGoing.source } },
]);

test("five v1 registrations are prepared once and placed without a hook command suffix", () => {
  const prepare = mock().mockReturnValueOnce(accepted(prepared)).mockReturnValueOnce(accepted(guard))
    .mockReturnValueOnce(accepted(log)).mockReturnValueOnce(accepted(start)).mockReturnValueOnce(accepted(keepGoing));
  expect(createKiroIdeHookRegistrations({ ...inputs, prepare })({ hooks: [] })).toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(5);
  expect(prepare).toHaveBeenNthCalledWith(1, human);
  expect(prepare).toHaveBeenNthCalledWith(5, keepGoing);
});

test("capture order and non-shipped hooks do not change the five registrations", () => {
  const prepare = mock().mockReturnValueOnce(accepted(prepared)).mockReturnValueOnce(accepted(guard))
    .mockReturnValueOnce(accepted(log)).mockReturnValueOnce(accepted(start)).mockReturnValueOnce(accepted(keepGoing));
  expect(createKiroIdeHookRegistrations({ ...inputs, prepare, files: [keepGoing, start, log, guard, human,
    { source: source("hooks/aidlc-session-end.json"), content: { kind: "text", text: "not shipped" } }],
  })({ hooks: [] })).toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(5);
});

test("a missing registration refuses rather than emitting a partial bundle", () => {
  expect(createKiroIdeHookRegistrations({ ...inputs, files: [human, guard, log, start] })({ hooks: [] }))
    .toEqual(refused({ kind: "render-failed", concept: "hook-registration",
      name: "hooks/aidlc-continue-workflow.json", reason: "The authored Kiro IDE hook registration was not captured." }));
});

test("preparation refusal retains its exact source and reason", () => {
  const failure = refused({ kind: "render-failed" as const, concept: "hook-registration" as const,
    name: "hooks/aidlc-record-human-turn.json", reason: "Token preparation refused." });
  const prepare = mock().mockReturnValueOnce(failure).mockReturnValueOnce(accepted(guard))
    .mockReturnValueOnce(accepted(log)).mockReturnValueOnce(accepted(start)).mockReturnValueOnce(accepted(keepGoing));
  expect(createKiroIdeHookRegistrations({ ...inputs, prepare })({ hooks: [] })).toEqual(failure);
});
