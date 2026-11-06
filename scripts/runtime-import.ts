export type RuntimeImportKind = 'runtime-builtin' | 'relative-source' | 'external';
export const runtimeImportKind = ({ specifier }: { readonly specifier: string }): RuntimeImportKind => {
  if (specifier === 'bun' || specifier.startsWith('node:') || specifier.startsWith('bun:')) return 'runtime-builtin';
  return specifier.startsWith('.') ? 'relative-source' : 'external';
};
