import { z } from "zod";

type CursorNativeTaskStopFields = {
  agent_id?: string;
  last_assistant_message?: string;
};

const cursorNativeTaskSuccessSchema = z.object({
  agentId: z.string().min(1).optional(),
  conversationSteps: z.array(z.object({
    assistantMessage: z.object({ text: z.string() }).optional(),
  })).optional(),
  isBackground: z.boolean().optional(),
});

type CursorNativeTaskOutput =
  | { status: "failed" }
  | { status: "success"; completion: z.infer<typeof cursorNativeTaskSuccessSchema> };

type CursorNativeTaskCompletion =
  | { status: "failed" | "pending" }
  | { status: "completed"; fields: CursorNativeTaskStopFields };

const cursorNativeTaskOutputSchema = z.union([
  z.object({ success: z.literal(false) }).transform((): CursorNativeTaskOutput => ({ status: "failed" })),
  z.object({ error: z.unknown().refine((error) => error !== undefined) }).transform((): CursorNativeTaskOutput => ({ status: "failed" })),
  z.object({ success: cursorNativeTaskSuccessSchema, error: z.never().optional() }).transform(({ success }): CursorNativeTaskOutput => ({ status: "success", completion: success })),
  cursorNativeTaskSuccessSchema.extend({
    success: z.never().optional(),
    error: z.never().optional(),
  }).transform((completion): CursorNativeTaskOutput => ({ status: "success", completion })),
]);

export function cursorNativeTaskCompletion({
  toolOutput,
}: {
  toolOutput: unknown;
}): CursorNativeTaskCompletion {
  let decodedOutput: unknown = toolOutput;
  if (typeof toolOutput === "string") {
    try {
      decodedOutput = JSON.parse(toolOutput);
    } catch {
      return { status: "completed", fields: { last_assistant_message: toolOutput } };
    }
  }
  if (typeof decodedOutput === "string") {
    return { status: "completed", fields: { last_assistant_message: decodedOutput } };
  }
  const parsed = cursorNativeTaskOutputSchema.safeParse(decodedOutput);
  if (!parsed.success) return { status: "pending" };
  if (parsed.data.status === "failed") return { status: "failed" };
  const completion = parsed.data.completion;
  if (completion.isBackground === true) return { status: "pending" };
  const message = completion.conversationSteps
    ?.flatMap(({ assistantMessage }) => assistantMessage === undefined ? [] : [assistantMessage.text])
    .at(-1);
  return {
    status: "completed",
    fields: {
      ...(completion.agentId === undefined ? {} : { agent_id: completion.agentId }),
      ...(message === undefined ? {} : { last_assistant_message: message }),
    },
  };
}
