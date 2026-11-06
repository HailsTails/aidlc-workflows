import { expect, test } from 'bun:test';
import { readPluginHookSource } from './plugin-hook-source.ts';
const manifest = { name: 'example', aidlc: { tokens: {}, hooks: { claude: [{ event: 'PreToolUse', target: 'example-guard', hookFile: 'guard.mjs', matcher: 'Bash|PowerShell' }] } } };
test('reads explicit hook identity without treating optional metadata as permissions', () => {
  expect(readPluginHookSource({ manifest, pluginName: 'example', harness: 'claude' })).toEqual({ kind: 'parsed', rows: [{ event: 'PreToolUse', target: 'example-guard', hookFile: 'guard.mjs', matcher: 'Bash|PowerShell', pluginName: 'example' }] });
});
test('an absent harness declaration is a legitimate empty contribution', () => {
  expect(readPluginHookSource({ manifest, pluginName: 'example', harness: 'kiro' })).toEqual({ kind: 'parsed', rows: [] });
});
test('hook path cannot escape the runtime directory', () => {
  expect(readPluginHookSource({ manifest: { name: 'example', aidlc: { hooks: { claude: [{ event: 'PreToolUse', target: 'example-guard', hookFile: '../guard.mjs' }] } } }, pluginName: 'example', harness: 'claude' })).toEqual({ kind: 'invalid', message: 'plugin example: invalid hook declaration at aidlc.hooks.claude.0.hookFile; require explicit native events and safe executable paths' });
});
test('quoting cannot turn an executable path into shell code', () => {
  expect(readPluginHookSource({ manifest: { name: 'example', aidlc: { hooks: { claude: [{ event: 'PreToolUse', target: 'example-guard', hookFile: 'guard.mjs"; run' }] } } }, pluginName: 'example', harness: 'claude' })).toEqual({ kind: 'invalid', message: 'plugin example: invalid hook declaration at aidlc.hooks.claude.0.hookFile; require explicit native events and safe executable paths' });
});
test('unknown events cannot silently become a nonfiring guard', () => {
  expect(readPluginHookSource({ manifest: { name: 'example', aidlc: { hooks: { claude: [{ event: 'BeforeAnyThing', target: 'example-guard', hookFile: 'guard.mjs' }] } } }, pluginName: 'example', harness: 'claude' })).toEqual({ kind: 'invalid', message: 'plugin example aidlc.hooks.claude[0].event: add a verified native event binding before projecting' });
});
test('an unrelated hook-free manifest needs no invented aidlc metadata', () => {
  expect(readPluginHookSource({ manifest: { name: 'example', version: '1.0.0' }, pluginName: 'example', harness: 'claude' })).toEqual({ kind: 'parsed', rows: [] });
});
test('malformed present hook declarations cannot become an empty contribution', () => {
  expect(readPluginHookSource({ manifest: { name: 'example', aidlc: { hooks: false } }, pluginName: 'example', harness: 'claude' })).toEqual({ kind: 'invalid', message: 'plugin example: invalid hook declaration at aidlc.hooks; require explicit native events and safe executable paths' });
});
test('unselected harness metadata cannot impose its grammar on Claude', () => {
  expect(readPluginHookSource({ manifest: { ...manifest, aidlc: { hooks: { claude: [{ event: 'PreToolUse', target: 'example-guard', hookFile: 'guard.mjs' }], cursor: [{ event: 'beforeShellExecution', nativeOnly: 'uninterpreted here' }] } } }, pluginName: 'example', harness: 'claude' })).toEqual({ kind: 'parsed', rows: [{ event: 'PreToolUse', target: 'example-guard', hookFile: 'guard.mjs', pluginName: 'example' }] });
});
test('foreign manifest identity cannot borrow the selected runtime owner', () => {
  expect(readPluginHookSource({ manifest, pluginName: 'another', harness: 'claude' })).toEqual({ kind: 'invalid', message: 'plugin another: manifest identity does not match the selected plugin' });
});
