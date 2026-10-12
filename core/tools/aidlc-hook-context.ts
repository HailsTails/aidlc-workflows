import { z } from "zod";

const hookContextSchema = z.object({
  additionalContext: z.string().optional(),
  hookSpecificOutput: z.object({ additionalContext: z.string().optional() }).optional(),
});

export function hookContextOf({ stdout, allowPlainText }: { stdout: string; allowPlainText: boolean }): string {
  if (!stdout.trim()) return "";
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return allowPlainText ? stdout.trim() : "";
  }
  const parsed = hookContextSchema.safeParse(payload);
  if (!parsed.success) return "";
  return parsed.data.hookSpecificOutput?.additionalContext ?? parsed.data.additionalContext ?? "";
}
