import { z } from 'zod';
import type { PluginHookRow } from '../core/tools/aidlc-plugin-hook-registrations.ts';
const hookRow = z.strictObject({ event: z.string().regex(/^[A-Z][A-Za-z]+$/), target: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/), hookFile: z.string().regex(/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:[cm]?[jt]s)$/), matcher: z.string().optional(), capabilityId: z.string().min(1).optional() });
const manifestSchema = ({ harness }: { readonly harness: string }) => z.looseObject({ name: z.string().min(1), aidlc: z.looseObject({ hooks: z.looseObject({ [harness]: z.array(hookRow).optional() }).optional() }).optional() });
const claudeEvents = ['PreToolUse','PostToolUse','UserPromptSubmit','SessionStart','SessionEnd','PreCompact','SubagentStart','SubagentStop','Stop'];
export function readPluginHookSource(input: { readonly manifest: unknown; readonly pluginName: string; readonly harness: string }): { readonly kind: 'parsed'; readonly rows: readonly PluginHookRow[] } | { readonly kind: 'invalid'; readonly message: string } {
  const parsed = manifestSchema({ harness: input.harness }).safeParse(input.manifest);
  if (!parsed.success) return { kind: 'invalid', message: `plugin ${input.pluginName}: invalid hook declaration at ${parsed.error.issues[0]?.path.join('.') ?? '$'}; require explicit native events and safe executable paths` };
  if (parsed.data.name !== input.pluginName) return { kind: 'invalid', message: `plugin ${input.pluginName}: manifest identity does not match the selected plugin` };
  const rows = parsed.data.aidlc?.hooks?.[input.harness] ?? [];
  const unsupported = input.harness === 'claude' ? rows.findIndex((row) => !claudeEvents.includes(row.event)) : -1;
  if (unsupported >= 0) return { kind: 'invalid', message: `plugin ${input.pluginName} aidlc.hooks.claude[${unsupported}].event: add a verified native event binding before projecting` };
  return { kind: 'parsed', rows: rows.map((row) => ({ event: row.event, target: row.target, hookFile: row.hookFile, pluginName: input.pluginName, ...(row.matcher === undefined ? {} : { matcher: row.matcher }), ...(row.capabilityId === undefined ? {} : { capabilityId: row.capabilityId }) })) };
}
