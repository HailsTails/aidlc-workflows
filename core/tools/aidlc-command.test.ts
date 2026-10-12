import { describe, expect, test } from "bun:test";
import { codexHookTrustIdentity } from "./aidlc-command.ts";

describe("normalized native Codex hook trust identity", () => {
  test("a tool matcher belongs to the canonical single-command identity", () => {
    expect(codexHookTrustIdentity({
      eventSnake: "pre_tool_use", matcher: "Bash",
      command: "bun .codex/tools/aidlc.ts engine adapter codex rin-block-inline-exec",
    })).toBe('{"event_name":"pre_tool_use","hooks":[{"async":false,"command":"bun .codex/tools/aidlc.ts engine adapter codex rin-block-inline-exec","timeout":600,"type":"command"}],"matcher":"Bash"}');
  });

  test("an omitted matcher retains the previous unrestricted identity", () => {
    expect(codexHookTrustIdentity({ eventSnake: "session_start", command: "guard" }))
      .toBe('{"event_name":"session_start","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}]}');
  });

  test("an empty matcher remains an explicit identity field", () => {
    expect(codexHookTrustIdentity({ eventSnake: "pre_tool_use", command: "guard", matcher: "" }))
      .toBe('{"event_name":"pre_tool_use","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":""}');
  });

  test("a match-all selector remains distinct from an omitted matcher", () => {
    expect(codexHookTrustIdentity({ eventSnake: "post_tool_use", command: "guard", matcher: "*" }))
      .toBe('{"event_name":"post_tool_use","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":"*"}');
  });

  test("a session selector retains its exact spelling", () => {
    expect(codexHookTrustIdentity({ eventSnake: "session_start", command: "guard", matcher: "startup|resume" }))
      .toBe('{"event_name":"session_start","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":"startup|resume"}');
  });

  test("a selector retains whitespace without normalization", () => {
    expect(codexHookTrustIdentity({ eventSnake: "pre_tool_use", command: "guard", matcher: " Bash " }))
      .toBe('{"event_name":"pre_tool_use","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":" Bash "}');
  });

  test.each([
    { eventSnake: "permission_request", expected: '{"event_name":"permission_request","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":"Bash"}' },
    { eventSnake: "session_end", expected: '{"event_name":"session_end","hooks":[{"async":false,"command":"guard","timeout":1,"type":"command"}],"matcher":"Bash"}' },
    { eventSnake: "subagent_start", expected: '{"event_name":"subagent_start","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":"Bash"}' },
    { eventSnake: "subagent_stop", expected: '{"event_name":"subagent_stop","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":"Bash"}' },
    { eventSnake: "pre_compact", expected: '{"event_name":"pre_compact","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":"Bash"}' },
    { eventSnake: "post_compact", expected: '{"event_name":"post_compact","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}],"matcher":"Bash"}' },
  ])("$eventSnake retains its matcher in the native identity", ({ eventSnake, expected }) => {
    expect(codexHookTrustIdentity({ eventSnake, command: "guard", matcher: "Bash" })).toBe(expected);
  });

  test("a prompt event discards a matcher ignored by native Codex", () => {
    expect(codexHookTrustIdentity({ eventSnake: "user_prompt_submit", command: "guard", matcher: "^hello" }))
      .toBe('{"event_name":"user_prompt_submit","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}]}');
  });

  test("a stop event discards a matcher ignored by native Codex", () => {
    expect(codexHookTrustIdentity({ eventSnake: "stop", command: "guard", matcher: "*" }))
      .toBe('{"event_name":"stop","hooks":[{"async":false,"command":"guard","timeout":600,"type":"command"}]}');
  });

  test("an interrupt event discards a matcher ignored by native Codex", () => {
    expect(codexHookTrustIdentity({ eventSnake: "interrupt", command: "guard", matcher: "*" }))
      .toBe('{"event_name":"interrupt","hooks":[{"async":false,"command":"guard","timeout":1,"type":"command"}]}');
  });
  test("an explicit compound timeout overrides the event default", () => {
    expect(codexHookTrustIdentity({ eventSnake: "stop", command: "guard", timeout: 3600 }))
      .toBe('{"event_name":"stop","hooks":[{"async":false,"command":"guard","timeout":3600,"type":"command"}]}');
  });
});
