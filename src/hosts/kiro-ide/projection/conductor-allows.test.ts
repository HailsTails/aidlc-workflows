import { expect, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { expandKiroIdeConductorAllows } from "./agent-renderer.ts";

const allows = { dispatcherCommands: ["doctor", "status"], toolScripts: ["not-a-dispatcher.ts"] };

test("copy conductor inserts only exact dispatcher commands after the one engine line", () => {
  expect(expandKiroIdeConductorAllows({ allows, invoke: "bun .kiro/tools/aidlc.ts",
    content: 'before\n        - "bun .kiro/tools/aidlc.ts engine *"\nafter\n',
  })).toEqual(accepted('before\n        - "bun .kiro/tools/aidlc.ts engine *"\n' +
    '        - "bun .kiro/tools/aidlc.ts doctor"\n        - "bun .kiro/tools/aidlc.ts status"\nafter\n'));
});

test("native conductor uses its supplied invocation without copy paths", () => {
  expect(expandKiroIdeConductorAllows({ allows, invoke: "aidlc",
    content: '        - "aidlc engine *"\nend',
  })).toEqual(accepted('        - "aidlc engine *"\n        - "aidlc doctor"\n        - "aidlc status"\nend'));
});

test("missing engine line refuses without changing the authored conductor", () => {
  expect(expandKiroIdeConductorAllows({ allows, invoke: "aidlc", content: "none\n" })).toEqual(refused({
    kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
    reason: 'agents/aidlc-aidlc.md must allow aidlc engine * exactly once',
  }));
});

test("duplicate engine lines refuse instead of duplicating dispatcher permissions", () => {
  expect(expandKiroIdeConductorAllows({ allows, invoke: "aidlc",
    content: '        - "aidlc engine *"\n        - "aidlc engine *"\n',
  })).toEqual(refused({ kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
    reason: 'agents/aidlc-aidlc.md must allow aidlc engine * exactly once' }));
});
