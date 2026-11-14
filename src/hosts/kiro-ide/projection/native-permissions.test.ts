import { expect, test } from "bun:test";
import { kiroIdeConductorPermissionSource, kiroIdeShellPermissionLines } from "./native-permissions.ts";
import { kiroIdeDelegateShellPolicy } from "./delegate-shell-deny.ts";
import { DELEGATE_SHELL_FACTS } from "../../../projection/fixtures/delegate-shell-facts.fixture.ts";

const policy = kiroIdeDelegateShellPolicy({ facts: { ...DELEGATE_SHELL_FACTS, engineNamespace: "work" }, directory: ".custom" });
const authored = '---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "old allow"\n    - capability: shell\n      effect: ask\n      match:\n        - "old ask"\n    - capability: shell\n      effect: deny\n      match:\n        - "bun .kiro/tools/aidlc-*"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n';

test("native shell rules are generated from policy/channel before any document exists", () => {
  expect(kiroIdeShellPermissionLines({ policy, channel: "native", dispatcherCommands: ["doctor", "status"] })).toEqual({
    allow: ["    - capability: shell", "      effect: allow", "      match:",
      '        - "aidlc work *"', '        - "aidlc doctor"', '        - "aidlc status"', '        - "bun --version"'],
    ask: ["    - capability: shell", "      effect: ask", "      match:",
      '        - "aidlc work config set *"', '        - "aidlc work adapter *"',
      '        - "aidlc*$*"', '        - "aidlc*`*"', '        - "aidlc*>*"', '        - "aidlc*<*"',
      '        - "aidlc*&*"', '        - "aidlc*@(*"', '        - "aidlc*@{*"', '        - "aidlc*\\n*"'],
  });
});

test("copy uses the supplied host directory and namespace, with no rendered native substitution", () => {
  const lines = kiroIdeShellPermissionLines({ policy, channel: "copy" });
  expect(lines.allow).toEqual(["    - capability: shell", "      effect: allow", "      match:",
    '        - "bun .custom/tools/aidlc-*"', '        - "bun .custom/tools/aidlc.ts work *"', '        - "bun --version"']);
  expect(lines.ask).toContain('        - "bun .custom/tools/aidlc.ts work config set *"');
  expect(lines.ask).toContain('        - "bun .custom/tools/aidlc*$*"');
});

test("captured conductor shell sections are generated while denials and body stay byte-identical", () => {
  expect(kiroIdeConductorPermissionSource({ source: authored, policy, channel: "native", dispatcherCommands: ["doctor"] }))
    .toBe('---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "aidlc work *"\n        - "aidlc doctor"\n        - "bun --version"\n    - capability: shell\n      effect: ask\n      match:\n        - "aidlc work config set *"\n        - "aidlc work adapter *"\n        - "aidlc*$*"\n        - "aidlc*`*"\n        - "aidlc*>*"\n        - "aidlc*<*"\n        - "aidlc*&*"\n        - "aidlc*@(*"\n        - "aidlc*@{*"\n        - "aidlc*\\n*"\n        - "*aidlc-doctor.ts*"\n        - "*aidlc-init.ts*"\n        - "*aidlc-lifecycle.ts*"\n        - "*aidlc-machine-config.ts*"\n    - capability: shell\n      effect: deny\n      match:\n        - "bun .kiro/tools/aidlc-*"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n');
});

test("body-only or unclosed documents are never interpreted as authored frontmatter", () => {
  expect(kiroIdeConductorPermissionSource({ source: `Body\n${authored}`, policy, channel: "native", dispatcherCommands: [] })).toBe(`Body\n${authored}`);
  expect(kiroIdeConductorPermissionSource({ source: "---\npermissions:\n", policy, channel: "copy", dispatcherCommands: [] })).toBe("---\npermissions:\n");
});
