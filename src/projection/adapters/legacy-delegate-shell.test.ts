import { expect, test } from "bun:test";
import { legacyDelegateShellPolicy } from "./legacy-delegate-shell.ts";

test("the bridge retains every risky shell spelling in its shipped order", () => {
  expect(legacyDelegateShellPolicy(".fixture").riskyForms).toEqual([
    "$", "`", ">", "<", "&", "@(", "@{", "\\n",
  ]);
});

test("delegated copy commands retain read exclusions without admitting a stage transition", () => {
  const deny = legacyDelegateShellPolicy(".fixture").shellDeny("aidlc-developer-agent");
  expect(deny).toEqual(expect.arrayContaining([
    "    - capability: shell",
    "      effect: deny",
    "      match:",
    '        - "bun .fixture/tools/aidlc-*"',
    '        - "bun .fixture/tools/aidlc.ts engine *"',
  ]));
  expect(deny).toContain('        - "bun .fixture/tools/aidlc-state.ts get"');
  expect(deny).toContain('        - "bun .fixture/tools/aidlc-state.ts get *"');
  expect(deny).not.toContain('        - "bun .fixture/tools/aidlc-orchestrate.ts next"');
  expect(deny).not.toContain('        - "bun .fixture/tools/aidlc-orchestrate.ts next *"');
});

test("risky forms deny the actual host dispatcher directory without hardcoding Kiro", () => {
  expect(legacyDelegateShellPolicy(".renamed").shellDeny("aidlc-developer-agent")).toEqual(expect.arrayContaining([
    "    - capability: shell",
    "      effect: deny",
    "      match:",
    '        - "bun .renamed/tools/aidlc*$*"',
    '        - "bun .renamed/tools/aidlc*`*"',
    '        - "bun .renamed/tools/aidlc*>*"',
    '        - "bun .renamed/tools/aidlc*<*"',
    '        - "bun .renamed/tools/aidlc*&*"',
    '        - "bun .renamed/tools/aidlc*@(*"',
    '        - "bun .renamed/tools/aidlc*@{*"',
    '        - "bun .renamed/tools/aidlc*\\n*"',
  ]));
});
