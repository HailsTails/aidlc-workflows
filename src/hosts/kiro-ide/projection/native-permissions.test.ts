import { expect, test } from "bun:test";
import { kiroIdeNativePermissionText, kiroIdeAgentPermissionContent } from "./native-permissions.ts";

test("only native shell allow and ask blocks change; DS denials and body text remain owned elsewhere", () => {
  expect(kiroIdeNativePermissionText({ namespace: "engine", text:
    'permissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "bun .kiro/tools/aidlc-*"\n        - "bun .kiro/tools/aidlc.ts engine *"\n    - capability: shell\n      effect: ask\n      match:\n        - "bun .kiro/tools/aidlc.ts engine adapter *"\n        - "bun .kiro/tools/aidlc*>*"\n    - capability: shell\n      effect: deny\n      match:\n        - "bun .kiro/tools/aidlc-*"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n',
  })).toBe('permissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "aidlc engine *"\n    - capability: shell\n      effect: ask\n      match:\n        - "aidlc engine adapter *"\n        - "aidlc*>*"\n    - capability: shell\n      effect: deny\n      match:\n        - "bun .kiro/tools/aidlc-*"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n');
});

test("copy preserves a captured byte buffer without decoding or rewriting", () => {
  const content = { kind: "bytes" as const, bytes: new Uint8Array([255, 0, 17]) };
  expect(kiroIdeAgentPermissionContent({ content, channel: "copy", namespace: "engine" })).toBe(content);
});

test("native captured bytes keep the same final text outside shell permissions", () => {
  expect(kiroIdeAgentPermissionContent({ content: { kind: "bytes", bytes: new Uint8Array([35, 32, 65, 10]) },
    channel: "native", namespace: "engine" })).toEqual({ kind: "text", text: "# A\n" });
});
