import { z } from "zod";

type LensReportChannel = "handback" | "stop-message";

type LensReport = {
  readonly agentType: string;
  readonly agentId: string;
  readonly channel: LensReportChannel;
  readonly reportText: string | undefined;
  readonly cwd: string | undefined;
  readonly sessionId: string;
};

type LensReportIntake =
  | { readonly kind: "report"; readonly report: LensReport }
  | { readonly kind: "undelivered-handback"; readonly agentType: string }
  | { readonly kind: "not-a-lens-report"; readonly reason: string };

const HANDBACK_TOOL_NAME = "SubagentHandback";

const HOOK_EVENT_NAME_FIELD = "hook_event_name";
const AGENT_TYPE_FIELD = "agent_type";
const AGENT_ID_FIELD = "agent_id";
const SESSION_ID_FIELD = "session_id";
const LAST_ASSISTANT_MESSAGE_FIELD = "last_assistant_message";
const TOOL_NAME_FIELD = "tool_name";
const TOOL_INPUT_FIELD = "tool_input";
const TOOL_RESPONSE_FIELD = "tool_response";

const sharedWireFields = {
  [AGENT_TYPE_FIELD]: z.string().optional(),
  [AGENT_ID_FIELD]: z.string().optional(),
  [SESSION_ID_FIELD]: z.string().optional(),
  cwd: z.string().optional(),
};

const hookEventSchema = z.object({
  [HOOK_EVENT_NAME_FIELD]: z.string().optional(),
});

const subagentStopSchema = z.object({
  ...sharedWireFields,
  [LAST_ASSISTANT_MESSAGE_FIELD]: z.string().optional(),
});

const handbackSchema = z.object({
  ...sharedWireFields,
  [TOOL_NAME_FIELD]: z.literal(HANDBACK_TOOL_NAME),
  [TOOL_INPUT_FIELD]: z.object({ message: z.string() }),
  [TOOL_RESPONSE_FIELD]: z.object({ success: z.boolean() }),
});

type SharedWire = {
  readonly [AGENT_TYPE_FIELD]?: string | undefined;
  readonly [AGENT_ID_FIELD]?: string | undefined;
  readonly [SESSION_ID_FIELD]?: string | undefined;
  readonly cwd?: string | undefined;
};

const lensReportOf = ({
  wire,
  channel,
  reportText,
}: {
  readonly wire: SharedWire;
  readonly channel: LensReportChannel;
  readonly reportText: string | undefined;
}): LensReportIntake => ({
  kind: "report",
  report: {
    agentType: wire[AGENT_TYPE_FIELD] ?? "",
    agentId: wire[AGENT_ID_FIELD] ?? "",
    channel,
    reportText,
    cwd: wire.cwd,
    sessionId: wire[SESSION_ID_FIELD] ?? "",
  },
});

const handbackIntakeOf = ({
  payload,
}: {
  readonly payload: unknown;
}): LensReportIntake => {
  const parsed = handbackSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      kind: "not-a-lens-report",
      reason: "PostToolUse payload is not a SubagentHandback call",
    };
  }
  if (!parsed.data[TOOL_RESPONSE_FIELD].success) {
    return {
      kind: "undelivered-handback",
      agentType: parsed.data[AGENT_TYPE_FIELD] ?? "",
    };
  }
  return lensReportOf({
    wire: parsed.data,
    channel: "handback",
    reportText: parsed.data[TOOL_INPUT_FIELD].message,
  });
};

const stopIntakeOf = ({
  payload,
}: {
  readonly payload: unknown;
}): LensReportIntake => {
  const parsed = subagentStopSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      kind: "not-a-lens-report",
      reason: "SubagentStop payload is malformed",
    };
  }
  return lensReportOf({
    wire: parsed.data,
    channel: "stop-message",
    reportText: parsed.data[LAST_ASSISTANT_MESSAGE_FIELD],
  });
};

const lensReportFromHookPayload = ({
  payload,
}: {
  readonly payload: unknown;
}): LensReportIntake => {
  const event = hookEventSchema.safeParse(payload);
  if (!event.success) {
    return { kind: "not-a-lens-report", reason: "payload is not an object" };
  }
  return event.data[HOOK_EVENT_NAME_FIELD] === "PostToolUse"
    ? handbackIntakeOf({ payload })
    : stopIntakeOf({ payload });
};

export {
  HANDBACK_TOOL_NAME,
  type LensReport,
  type LensReportChannel,
  type LensReportIntake,
  lensReportFromHookPayload,
};
