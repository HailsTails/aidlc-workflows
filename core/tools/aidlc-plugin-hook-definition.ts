import type { PluginHookRow } from './aidlc-plugin-hook-registrations.ts';
export type BootstrapHookProducts = {
  readonly destinations: readonly string[];
  readonly matchedReference: { readonly source: string; readonly destination: string } | null;
};
export type AuthoredHookProductInput = {
  readonly source: string;
  readonly destination: string;
  readonly bootstrap: BootstrapHookProducts;
};
export type AuthoredHookProductDecision = { readonly kind: 'copy' } | { readonly kind: 'reuse-bootstrap' } | { readonly kind: 'conflict' };
export function authoredHookProduct(input: AuthoredHookProductInput): AuthoredHookProductDecision {
  if (!input.bootstrap.destinations.includes(input.destination)) return { kind: 'copy' };
  const reference = input.bootstrap.matchedReference;
  return reference !== null && reference.source === input.source && reference.destination === input.destination
    ? { kind: 'reuse-bootstrap' }
    : { kind: 'conflict' };
}
export function bindPluginHookSources(input: { readonly rows: readonly PluginHookRow[]; readonly authoredFiles: readonly string[]; readonly projectedFiles: readonly string[] }): { readonly kind: 'bound'; readonly rows: readonly PluginHookRow[] } | { readonly kind: 'refused'; readonly message: string } {
  const missing = input.rows.find((row) => !input.authoredFiles.includes(`hooks/${row.hookFile}`) || !input.projectedFiles.includes(`hooks/${row.hookFile}`));
  return missing === undefined ? { kind: 'bound', rows: input.rows } : { kind: 'refused', message: `plugin ${missing.pluginName}: declared hook body hooks/${missing.hookFile} must exist in both authored and projected runtime inputs` };
}
