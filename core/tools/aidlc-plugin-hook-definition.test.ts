import { expect, test } from 'bun:test';
import { authoredHookProduct, bindPluginHookSources, type AuthoredHookProductInput, type AuthoredHookProductDecision } from './aidlc-plugin-hook-definition.ts';
const rows = [{ pluginName: 'example', event: 'PreToolUse', target: 'guard', hookFile: 'guard.mjs' }];
test('binds declared entrypoints to actual authored and projected modules', () => {
  expect(bindPluginHookSources({ rows, authoredFiles: ['hooks/guard.mjs'], projectedFiles: ['hooks/guard.mjs'] })).toEqual({ kind: 'bound', rows });
});
test('a bootstrap output cannot stand in for an absent authored entrypoint', () => {
  expect(bindPluginHookSources({ rows, authoredFiles: [], projectedFiles: ['hooks/guard.mjs'] })).toEqual({ kind: 'refused', message: 'plugin example: declared hook body hooks/guard.mjs must exist in both authored and projected runtime inputs' });
});
test('an authored entrypoint must actually be delivered', () => {
  expect(bindPluginHookSources({ rows, authoredFiles: ['hooks/guard.mjs'], projectedFiles: [] })).toEqual({ kind: 'refused', message: 'plugin example: declared hook body hooks/guard.mjs must exist in both authored and projected runtime inputs' });
});
test('a plugin without declared hooks needs no invented executable', () => {
  expect(bindPluginHookSources({ rows: [], authoredFiles: [], projectedFiles: [] })).toEqual({ kind: 'bound', rows: [] });
});

test.each([
  { name: 'reuses the exact validated vendored reference at its emitted destination', input: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts', bootstrap: { destinations: ['output/hooks/compose.ts'], matchedReference: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts' } } }, expected: { kind: 'reuse-bootstrap' } },
  { name: 'refuses an emitted bootstrap destination without a matched reference', input: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts', bootstrap: { destinations: ['output/hooks/compose.ts'], matchedReference: null } }, expected: { kind: 'conflict' } },
  { name: 'copies a nested hook with the same basename at a different destination', input: { source: 'plugin/hooks/sub/compose.ts', destination: 'output/hooks/sub/compose.ts', bootstrap: { destinations: ['output/hooks/compose.ts'], matchedReference: null } }, expected: { kind: 'copy' } },
  { name: 'copies a template helper name which the host did not emit', input: { source: 'plugin/hooks/aidlc-plugin-compose.ts', destination: 'output/hooks/aidlc-plugin-compose.ts', bootstrap: { destinations: ['output/hooks/compose.ts'], matchedReference: null } }, expected: { kind: 'copy' } },
  { name: 'refuses another bootstrap destination even for the matched source', input: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/helper.ts', bootstrap: { destinations: ['output/hooks/compose.ts', 'output/hooks/helper.ts'], matchedReference: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts' } } }, expected: { kind: 'conflict' } },
  { name: 'refuses a different source claiming a matched bootstrap destination', input: { source: 'plugin/hooks/other.ts', destination: 'output/hooks/compose.ts', bootstrap: { destinations: ['output/hooks/compose.ts'], matchedReference: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts' } } }, expected: { kind: 'conflict' } },
  { name: 'canonical destination alias facts still refuse an unmatched source', input: { source: 'plugin/hooks/COMPOSE.ts', destination: 'output/hooks/compose.ts', bootstrap: { destinations: ['output/hooks/compose.ts'], matchedReference: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts' } } }, expected: { kind: 'conflict' } },
  { name: 'copies an ordinary authored hook', input: { source: 'plugin/hooks/guard.ts', destination: 'output/hooks/guard.ts', bootstrap: { destinations: ['output/hooks/compose.ts'], matchedReference: null } }, expected: { kind: 'copy' } },
  { name: 'an un-emitted matched path has no bootstrap ownership to reuse', input: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts', bootstrap: { destinations: [], matchedReference: { source: 'plugin/hooks/compose.ts', destination: 'output/hooks/compose.ts' } } }, expected: { kind: 'copy' } },
] satisfies readonly { readonly name: string; readonly input: AuthoredHookProductInput; readonly expected: AuthoredHookProductDecision }[])('$name', ({ input, expected }) => {
  expect(authoredHookProduct(input)).toEqual(expected);
});
