import { expect, test } from "bun:test";
import { CURSOR_HOST_DATA, CURSOR_TOKENS, CURSOR_AUTHORED_PLACEMENTS } from "./host-data.ts";

test("Cursor declares its conversation and explicit-only runner surface", () => {
  expect(CURSOR_HOST_DATA).toEqual({
    productName: "Cursor",
    configNextStep: "open this project in Cursor, then run `/aidlc --doctor`",
    rulesFolder: null,
    hostShell: { env: ["CURSOR_AGENT"] },
    newChatStep: { text: "open a new chat, then type <entry>" },
    runnerFrontmatterAdditions: ["disable-model-invocation: true"],
  });
  expect(CURSOR_TOKENS).toEqual({ ["SKILL_INVOKE"]: null, ["OPTION_LETTERS"]: "A-E" });
});

test("Cursor places its native rules and adapter without taking settings or copy-only inputs", () => {
  expect(CURSOR_AUTHORED_PLACEMENTS).toEqual([
    { source: "rules-aidlc.mdc", destination: ".cursor/rules/aidlc.mdc" },
    { source: "rules-aidlc-phase-ideation.mdc", destination: ".cursor/rules/aidlc-phase-ideation.mdc" },
    { source: "rules-aidlc-phase-inception.mdc", destination: ".cursor/rules/aidlc-phase-inception.mdc" },
    { source: "rules-aidlc-phase-construction.mdc", destination: ".cursor/rules/aidlc-phase-construction.mdc" },
    { source: "rules-aidlc-phase-operation.mdc", destination: ".cursor/rules/aidlc-phase-operation.mdc" },
    { source: "hooks/aidlc-cursor-adapter.ts", destination: ".cursor/hooks/aidlc-cursor-adapter.ts" },
    { source: "dot-gitignore", destination: ".gitignore" },
  ]);
});
