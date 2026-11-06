import { expect, test } from 'bun:test';
import { prepareClaudePluginHooks } from './aidlc-plugin-hook-composition.ts';
const group = { hooks: [{ type: 'command', command: 'owned guard' }] } as const;
const payload = { schemaVersion: 1, pluginName: 'example', harness: 'claude', registrations: [{ kind: 'group', path: '.claude/settings.json', event: 'PreToolUse', group }] } as const;
const document = { path: '.claude/settings.json', text: '{"unrelated":1,"hooks":{"SessionStart":[]}}' };
test('fresh hooks preserve existing settings and record their contribution', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: "selected", payload, runtime: [{ path: "hooks/guard.mjs", expected: "digest", installed: "digest" }] }, previous: undefined, document })).toEqual({ kind: 'prepared', documents: [{ path: '.claude/settings.json', text: '{\n  "unrelated": 1,\n  "hooks": {\n    "SessionStart": [],\n    "PreToolUse": [\n      {\n        "hooks": [\n          {\n            "type": "command",\n            "command": "owned guard"\n          }\n        ]\n      }\n    ]\n  }\n}\n' }], ownership: payload });
});
test('foreign plugin cannot borrow ownership', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'another', selection: { kind: "selected", payload, runtime: [{ path: "hooks/guard.mjs", expected: "digest", installed: "digest" }] }, previous: undefined, document })).toEqual({ kind: 'refused', message: 'authored Claude hook contributions must bind the selected plugin and harness' });
});
test('a missing owned group cannot be adopted as an unrelated entry', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: "selected", payload, runtime: [{ path: "hooks/guard.mjs", expected: "digest", installed: "digest" }] }, previous: payload, document })).toEqual({ kind: 'refused', message: 'plugin hook registration refused: .claude/settings.json: missing-owned-value' });
});
test('unknown native destination cannot redirect writes', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: "selected", payload: { ...payload, registrations: [{ ...payload.registrations[0], path: '.claude/other.json' }] }, runtime: [] }, previous: undefined, document })).toEqual({ kind: 'refused', message: 'authored Claude hook contributions must bind the selected plugin and harness' });
});
test('missing runtime bytes cannot acquire executable registrations', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: 'selected', payload, runtime: [{ path: 'hooks/guard.mjs', expected: 'digest', installed: null }] }, previous: undefined, document })).toEqual({ kind: 'refused', message: 'authored hook runtime unavailable or changed: hooks/guard.mjs' });
});
test('a changed helper cannot hide behind a present entrypoint', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: 'selected', payload, runtime: [{ path: 'hooks/guard.mjs', expected: 'digest', installed: 'digest' }, { path: 'tools/shared.runtime.js', expected: 'source', installed: 'edited' }] }, previous: undefined, document })).toEqual({ kind: 'refused', message: 'authored hook runtime unavailable or changed: tools/shared.runtime.js' });
});
test('empty observed runtime cannot bypass declaration binding', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: 'selected', payload, runtime: [] }, previous: undefined, document })).toEqual({ kind: 'refused', message: 'authored hook registration requires an observed executable runtime footprint' });
});
test('retirement removes exactly its owned group', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: 'deselected' }, previous: payload, document: { path: '.claude/settings.json', text: '{"unrelated":1,"hooks":{"PreToolUse":[{"hooks":[{"type":"command","command":"owned guard"}]}]}}' } })).toEqual({ kind: 'prepared', documents: [{ path: '.claude/settings.json', text: '{\n  "unrelated": 1,\n  "hooks": {\n    "PreToolUse": []\n  }\n}\n' }], ownership: { ...payload, registrations: [] } });
});
test('a malformed present ownership record refuses retirement', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: 'deselected' }, previous: {}, document })).toEqual({ kind: 'refused', message: 'authored Claude hook contributions must bind the selected plugin and harness' });
});
test('read-only inspection cannot repair a missing owned registration', () => {
  expect(prepareClaudePluginHooks({ pluginName: 'example', selection: { kind: 'inspect' }, previous: payload, document })).toEqual({ kind: 'refused', message: 'plugin hook registration refused: .claude/settings.json: missing-owned-value' });
});
