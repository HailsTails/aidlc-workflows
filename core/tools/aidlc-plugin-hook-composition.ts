import { planPluginHookRegistrations, projectedPluginHookContributionsSchema, type HookRegistrationDocument, type ProjectedPluginHookContributions } from './aidlc-plugin-hook-registrations.ts';
export type HookRuntimeFile = { readonly path: string; readonly expected: string; readonly installed: string | null };
export type ClaudePluginHookSelection = { readonly kind: 'selected'; readonly payload: unknown; readonly runtime: readonly HookRuntimeFile[] } | { readonly kind: 'deselected' } | { readonly kind: 'inspect' };
export type ClaudePluginHookPreparation = { readonly kind: 'prepared'; readonly documents: readonly HookRegistrationDocument[]; readonly ownership: ProjectedPluginHookContributions } | { readonly kind: 'refused'; readonly message: string };
type HookRefusal = { readonly kind: 'refused'; readonly message: string };
type HookOwnership = { readonly kind: 'bound'; readonly ownership: ProjectedPluginHookContributions };
type ClaudeHookPreparationInput = { readonly pluginName: string; readonly selection: ClaudePluginHookSelection; readonly previous: unknown; readonly document: HookRegistrationDocument };
const readOwnership = ({ pluginName, payload, documentPath }: { readonly pluginName: string; readonly payload: unknown; readonly documentPath: string }): HookOwnership | HookRefusal => {
  const parsed = projectedPluginHookContributionsSchema.parse(payload);
  if (parsed.kind !== 'parsed' || parsed.value.pluginName !== pluginName || parsed.value.harness !== 'claude') return { kind: 'refused', message: 'authored Claude hook contributions must bind the selected plugin and harness' };
  if (documentPath !== '.claude/settings.json' || parsed.value.registrations.some((registration) => registration.kind !== 'group' || registration.path !== documentPath)) return { kind: 'refused', message: 'authored Claude hook contributions may update only the selected native settings document' };
  return { kind: 'bound', ownership: parsed.value };
};
const admitRuntime = ({ selection, ownership }: { readonly selection: ClaudePluginHookSelection; readonly ownership: ProjectedPluginHookContributions }): { readonly kind: 'ready' } | HookRefusal => {
  if (selection.kind !== 'selected' || ownership.registrations.length === 0) return { kind: 'ready' };
  if (selection.runtime.length === 0) return { kind: 'refused', message: 'authored hook registration requires an observed executable runtime footprint' };
  const unavailable = selection.runtime.find((file) => file.expected !== file.installed);
  return unavailable === undefined ? { kind: 'ready' } : { kind: 'refused', message: `authored hook runtime unavailable or changed: ${unavailable.path}` };
};
const previousOwnership = ({ input, current }: { readonly input: ClaudeHookPreparationInput; readonly current: ProjectedPluginHookContributions }): { readonly kind: 'bound'; readonly ownership: ProjectedPluginHookContributions | null } | HookRefusal => {
  if (input.previous === undefined) return { kind: 'bound', ownership: null };
  if (input.selection.kind !== 'selected') return { kind: 'bound', ownership: current };
  const previous = readOwnership({ pluginName: input.pluginName, payload: input.previous, documentPath: input.document.path });
  return previous.kind === 'refused' ? { kind: 'refused', message: 'recorded Claude hook contribution ownership does not bind the selected plugin and harness' } : previous;
};
const planChange = ({ input, current, previous }: { readonly input: ClaudeHookPreparationInput; readonly current: ProjectedPluginHookContributions; readonly previous: ProjectedPluginHookContributions | null }): ClaudePluginHookPreparation => {
  const plan = planPluginHookRegistrations({ pluginName: input.pluginName, harness: 'claude', selection: { kind: input.selection.kind === 'deselected' ? 'deselected' : 'selected' }, previous: previous?.registrations ?? [], current: input.selection.kind === 'deselected' ? [] : current.registrations, documents: [input.document] });
  return plan.kind === 'conflict' ? { kind: 'refused', message: `plugin hook registration refused: ${plan.error.path}: ${plan.error.reason}` } : { kind: 'prepared', documents: plan.documents, ownership: { ...current, registrations: plan.ownedRegistrations } };
};
export function prepareClaudePluginHooks(input: ClaudeHookPreparationInput): ClaudePluginHookPreparation {
  const current = readOwnership({ pluginName: input.pluginName, payload: input.selection.kind === 'selected' ? input.selection.payload : input.previous, documentPath: input.document.path });
  if (current.kind === 'refused') return current;
  const runtime = admitRuntime({ selection: input.selection, ownership: current.ownership });
  if (runtime.kind === 'refused') return runtime;
  const previous = previousOwnership({ input, current: current.ownership });
  return previous.kind === 'refused' ? previous : planChange({ input, current: current.ownership, previous: previous.ownership });
}
