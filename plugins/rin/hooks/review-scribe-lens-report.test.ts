import { describe, expect, test } from "vitest";
import { lensReportFromHookPayload } from "./review-scribe-lens-report.ts";

const REPORT = "## Verdict\nREADY\nReviewed head sha: d6d82218";

describe("a SubagentHandback PostToolUse is a lens report", () => {
  test("a delivered hand-back carries its message as the report", () => {
    const intake = lensReportFromHookPayload({
      payload: {
        ["hook_event_name"]: "PostToolUse",
        ["agent_type"]: "rin-naming-reviewer-agent",
        ["agent_id"]: "a0bb1c0ac71973e36",
        ["session_id"]: "session-one",
        cwd: "/checkout",
        ["tool_name"]: "SubagentHandback",
        ["tool_input"]: { message: REPORT },
        ["tool_response"]: {
          success: true,
          message: "Report delivered to your caller.",
        },
      },
    });
    expect(intake).toEqual({
      kind: "report",
      report: {
        agentType: "rin-naming-reviewer-agent",
        agentId: "a0bb1c0ac71973e36",
        channel: "handback",
        reportText: REPORT,
        cwd: "/checkout",
        sessionId: "session-one",
      },
    });
  });

  test("a refused hand-back is not a report, so a second call cannot replace the delivered one", () => {
    const intake = lensReportFromHookPayload({
      payload: {
        ["hook_event_name"]: "PostToolUse",
        ["agent_type"]: "rin-naming-reviewer-agent",
        ["tool_name"]: "SubagentHandback",
        ["tool_input"]: { message: REPORT },
        ["tool_response"]: {
          success: false,
          message:
            "Nothing was sent: your report was already delivered (SubagentHandback delivers one report).",
        },
      },
    });
    expect(intake).toEqual({
      kind: "undelivered-handback",
      agentType: "rin-naming-reviewer-agent",
    });
  });

  test("a PostToolUse for any other tool is not a lens report", () => {
    const intake = lensReportFromHookPayload({
      payload: {
        ["hook_event_name"]: "PostToolUse",
        ["agent_type"]: "rin-naming-reviewer-agent",
        ["tool_name"]: "Read",
        ["tool_input"]: { ["file_path"]: "/checkout/a.ts" },
        ["tool_response"]: { success: true },
      },
    });
    expect(intake.kind).toBe("not-a-lens-report");
  });
});

describe("a SubagentStop is a lens report through its last message", () => {
  test("a named SubagentStop carries last_assistant_message as the report", () => {
    const intake = lensReportFromHookPayload({
      payload: {
        ["hook_event_name"]: "SubagentStop",
        ["agent_type"]: "rin-naming-reviewer-agent",
        ["agent_id"]: "ad9511dec191a9a7f",
        ["session_id"]: "session-two",
        cwd: "/checkout",
        ["last_assistant_message"]: REPORT,
      },
    });
    expect(intake).toEqual({
      kind: "report",
      report: {
        agentType: "rin-naming-reviewer-agent",
        agentId: "ad9511dec191a9a7f",
        channel: "stop-message",
        reportText: REPORT,
        cwd: "/checkout",
        sessionId: "session-two",
      },
    });
  });

  test("a payload with no event name is read as a SubagentStop, the shape every face delivered before hand-backs", () => {
    const intake = lensReportFromHookPayload({
      payload: {
        ["agent_type"]: "rin-naming-reviewer-agent",
        ["last_assistant_message"]: REPORT,
      },
    });
    expect(intake).toEqual({
      kind: "report",
      report: {
        agentType: "rin-naming-reviewer-agent",
        agentId: "",
        channel: "stop-message",
        reportText: REPORT,
        cwd: undefined,
        sessionId: "",
      },
    });
  });
});

describe("a payload that is not an object is not a lens report", () => {
  test("a string payload is refused", () => {
    const intake = lensReportFromHookPayload({ payload: "not json object" });
    expect(intake.kind).toBe("not-a-lens-report");
  });
});
