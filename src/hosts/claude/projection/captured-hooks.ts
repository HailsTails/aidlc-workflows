import { z } from "zod";
import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { NativeCommandRoutes } from "../../../projection/domain/native-command.ts";
import { admitClaudeHookCommand, renderClaudeHookCommand } from "./hook-command.ts";

const fieldsSchema = z.record(z.string(), z.unknown());
const arraySchema = z.array(z.unknown());
const commandSchema = z.object({ type: z.literal("command"), command: z.string() });

type HookChannel = {
  readonly directory: string | null; readonly channel: DistributionChannel;
  readonly trusted: NativeCommandRoutes["trusted"];
};

const projectCommand = (raw: unknown, channel: HookChannel): unknown => {
  if (typeof raw !== "object" || raw === null) return raw;
  const command = commandSchema.safeParse(raw);
  if (!command.success) return raw;
  const admitted = admitClaudeHookCommand({ command: command.data.command, directory: channel.directory });
  return { ...raw, command: renderClaudeHookCommand({
    command: admitted, channel: channel.channel, trusted: channel.trusted }) };
};

const projectMatcher = (raw: unknown, channel: HookChannel): unknown => {
  if (typeof raw !== "object" || raw === null) return raw;
  const fields = fieldsSchema.safeParse(raw);
  if (!fields.success) return raw;
  const hooks = arraySchema.safeParse(fields.data["hooks"]);
  return hooks.success ? { ...raw, hooks: hooks.data.map((hook) => projectCommand(hook, channel)) }
    : raw;
};

export const projectCapturedClaudeHooks = (request: HookChannel & { readonly captured: unknown }): unknown => {
  if (typeof request.captured !== "object" || request.captured === null) return request.captured;
  const events = fieldsSchema.safeParse(request.captured);
  if (!events.success) return request.captured;
  return Object.fromEntries(Object.entries(request.captured).map(([name, raw]) => {
    const matchers = arraySchema.safeParse(raw);
    return [name, matchers.success ? matchers.data.map((matcher) => projectMatcher(matcher, request)) : raw];
  }));
};
