import { expect, mock, test, type Mock } from "bun:test";
import { prepareClaudeCopyAllowList, prepareClaudeNativeAllowList, type ClaudeCopyCommandAuthority, type ClaudeNativeCommandAuthority } from "./claude-settings.ts";

export type ClaudeCopyAuthorityFixture = Readonly<{
  dispatcherCommands: Mock<ClaudeCopyCommandAuthority["dispatcherCommands"]>;
  toolScripts: Mock<ClaudeCopyCommandAuthority["toolScripts"]>;
}>;
export type ClaudeNativeAuthorityFixture = Readonly<{
  trustedCommand: Mock<ClaudeNativeCommandAuthority["trustedCommand"]>;
  dispatcherCommands: Mock<ClaudeNativeCommandAuthority["dispatcherCommands"]>;
}>;
export type QueryRecorder = (input: Readonly<{ label: string }>) => void;
export type ClaudeAuthorityTraceFixture = Readonly<{
  copy: ClaudeCopyCommandAuthority;
  native: ClaudeNativeCommandAuthority;
  recorder: Mock<QueryRecorder>;
}>;

const copyAuthority = (): ClaudeCopyAuthorityFixture => ({ dispatcherCommands: mock<ClaudeCopyCommandAuthority["dispatcherCommands"]>().mockReturnValue(["doctor"]), toolScripts: mock<ClaudeCopyCommandAuthority["toolScripts"]>().mockReturnValue(["aidlc-check.ts"]) });
const nativeAuthority = (): ClaudeNativeAuthorityFixture => ({ trustedCommand: mock<ClaudeNativeCommandAuthority["trustedCommand"]>().mockReturnValue("aidlc engine *"), dispatcherCommands: mock<ClaudeNativeCommandAuthority["dispatcherCommands"]>().mockReturnValue(["aidlc doctor"]) });

const authorityTrace = (): ClaudeAuthorityTraceFixture => {
  const recorder = mock<QueryRecorder>().mockReturnValue(undefined);
  const copy = copyAuthority();
  const native = nativeAuthority();
  return {
    copy: {
      dispatcherCommands: () => { recorder({ label: "copy.dispatcher" }); return copy.dispatcherCommands(); },
      toolScripts: () => { recorder({ label: "copy.tools" }); return copy.toolScripts(); },
    },
    native: {
      trustedCommand: (input) => { recorder({ label: "native.trusted" }); return native.trustedCommand(input); },
      dispatcherCommands: () => { recorder({ label: "native.dispatcher" }); return native.dispatcherCommands(); },
    },
    recorder,
  };
};

test("copy queries dispatcher before tools for each equal glob", () => {
  const fixture = authorityTrace();
  expect(prepareClaudeCopyAllowList({ allow: ["Bash(bun .claude/tools/aidlc-*)", "Bash(bun .claude/tools/aidlc-*)"], authority: fixture.copy })).toEqual({ kind: "prepared", allow: ["Bash(bun .claude/tools/aidlc.ts doctor)", "Bash(bun .claude/tools/aidlc-check.ts)", "Bash(bun .claude/tools/aidlc-check.ts *)", "Bash(bun .claude/tools/aidlc.ts doctor)", "Bash(bun .claude/tools/aidlc-check.ts)", "Bash(bun .claude/tools/aidlc-check.ts *)"] });
  expect(fixture.recorder.mock.calls).toEqual([[{ label: "copy.dispatcher" }], [{ label: "copy.tools" }], [{ label: "copy.dispatcher" }], [{ label: "copy.tools" }]]);
});

test("native queries trusted command before dispatcher", () => {
  const fixture = authorityTrace();
  expect(prepareClaudeNativeAllowList({ allow: ["Read", "Bash(aidlc engine *)"], authority: fixture.native })).toEqual({ kind: "prepared", allow: ["Read", "Bash(aidlc engine *)", "Bash(aidlc doctor)"] });
  expect(fixture.recorder.mock.calls).toEqual([[{ label: "native.trusted" }], [{ label: "native.dispatcher" }]]);
});

test("copy projection expands only supplied canonical command authority", () => {
  const authority = copyAuthority();
  expect(prepareClaudeCopyAllowList({ allow: ["Read", "Bash(bun .claude/tools/aidlc-*)", "Write"], authority })).toEqual({ kind: "prepared", allow: ["Read", "Bash(bun .claude/tools/aidlc.ts doctor)", "Bash(bun .claude/tools/aidlc-check.ts)", "Bash(bun .claude/tools/aidlc-check.ts *)", "Write"] });
  expect(authority.dispatcherCommands.mock.calls).toEqual([[]]);
  expect(authority.toolScripts.mock.calls).toEqual([[]]);
});

test("first matching spelling selects expansion without rewriting a different glob", () => {
  const authority = copyAuthority();
  expect(prepareClaudeCopyAllowList({ allow: ["Bash(bun .custom/tools/aidlc-*)", "Bash(bun .claude/tools/aidlc-*)"], authority })).toEqual({ kind: "prepared", allow: ["Bash(bun .custom/tools/aidlc.ts doctor)", "Bash(bun .custom/tools/aidlc-check.ts)", "Bash(bun .custom/tools/aidlc-check.ts *)", "Bash(bun .claude/tools/aidlc-*)"] });
  expect(authority.dispatcherCommands.mock.calls).toEqual([[]]);
  expect(authority.toolScripts.mock.calls).toEqual([[]]);
});

test("all entries equal to the selected glob query authority separately", () => {
  const authority = copyAuthority();
  expect(prepareClaudeCopyAllowList({ allow: ["Bash(bun .claude/tools/aidlc-*)", "Read", "Bash(bun .claude/tools/aidlc-*)"], authority })).toEqual({ kind: "prepared", allow: ["Bash(bun .claude/tools/aidlc.ts doctor)", "Bash(bun .claude/tools/aidlc-check.ts)", "Bash(bun .claude/tools/aidlc-check.ts *)", "Read", "Bash(bun .claude/tools/aidlc.ts doctor)", "Bash(bun .claude/tools/aidlc-check.ts)", "Bash(bun .claude/tools/aidlc-check.ts *)"] });
  expect(authority.dispatcherCommands.mock.calls).toEqual([[], []]);
  expect(authority.toolScripts.mock.calls).toEqual([[], []]);
});

const COPY_REFUSALS: readonly { name: string; allow: unknown }[] = [
  { name: "missing list", allow: undefined }, { name: "null list", allow: null }, { name: "numeric list", allow: 0 }, { name: "boolean list", allow: false },
  { name: "string list", allow: "Bash(bun .claude/tools/aidlc-*)" }, { name: "object list", allow: {} }, { name: "empty list", allow: [] },
  { name: "nonstring entries", allow: [null, false, 7, {}] }, { name: "space inside authored directory", allow: ["Bash(bun .cla ude/tools/aidlc-*)"] },
  { name: "glob with arguments", allow: ["Bash(bun .claude/tools/aidlc-* *)"] }, { name: "glob suffix", allow: ["Bash(bun .claude/tools/aidlc-*)extra"] },
  { name: "concrete tool is not authored glob", allow: ["Bash(bun .claude/tools/aidlc.ts *)"] },
];

test.each([...COPY_REFUSALS])("copy malformed allow refuses before authority: $name", ({ allow }) => {
  const authority = copyAuthority();
  expect(prepareClaudeCopyAllowList({ allow, authority })).toEqual({ kind: "refused", message: "[claude] settings.json has no Bash(bun <dir>/tools/aidlc-*) entry to expand" });
  expect(authority.dispatcherCommands.mock.calls).toEqual([]);
  expect(authority.toolScripts.mock.calls).toEqual([]);
});

test("copy keeps frozen nonstring values by identity and does not mutate input", () => {
  const authority = copyAuthority();
  const kept = Object.freeze({ arbitrary: ["value"] });
  const input = Object.freeze([kept, null, false, 7, "Bash(bun .claude/tools/aidlc-*)"]);
  const prepared = prepareClaudeCopyAllowList({ allow: input, authority });
  const allow: unknown = Reflect.get(prepared, "allow");
  expect(allow).toContain(kept);
  expect(prepared).toEqual({ kind: "prepared", allow: [kept, null, false, 7, "Bash(bun .claude/tools/aidlc.ts doctor)", "Bash(bun .claude/tools/aidlc-check.ts)", "Bash(bun .claude/tools/aidlc-check.ts *)"] });
  expect(input).toEqual([kept, null, false, 7, "Bash(bun .claude/tools/aidlc-*)"]);
});

test("empty authority removes the selected glob without inventing grants", () => {
  const authority = { dispatcherCommands: mock<ClaudeCopyCommandAuthority["dispatcherCommands"]>().mockReturnValue([]), toolScripts: mock<ClaudeCopyCommandAuthority["toolScripts"]>().mockReturnValue([]) };
  expect(prepareClaudeCopyAllowList({ allow: ["Read", "Bash(bun .claude/tools/aidlc-*)"], authority })).toEqual({ kind: "prepared", allow: ["Read"] });
  expect(authority.dispatcherCommands.mock.calls).toEqual([[]]);
  expect(authority.toolScripts.mock.calls).toEqual([[]]);
});

test("authority ordering and duplicates are retained", () => {
  const authority = { dispatcherCommands: mock<ClaudeCopyCommandAuthority["dispatcherCommands"]>().mockReturnValue(["second", "first", "second"]), toolScripts: mock<ClaudeCopyCommandAuthority["toolScripts"]>().mockReturnValue(["z.ts", "a.ts", "z.ts"]) };
  expect(prepareClaudeCopyAllowList({ allow: ["Bash(bun .claude/tools/aidlc-*)"], authority })).toEqual({ kind: "prepared", allow: ["Bash(bun .claude/tools/aidlc.ts second)", "Bash(bun .claude/tools/aidlc.ts first)", "Bash(bun .claude/tools/aidlc.ts second)", "Bash(bun .claude/tools/z.ts)", "Bash(bun .claude/tools/z.ts *)", "Bash(bun .claude/tools/a.ts)", "Bash(bun .claude/tools/a.ts *)", "Bash(bun .claude/tools/z.ts)", "Bash(bun .claude/tools/z.ts *)"] });
});

test("native removes original broad shell entries then appends explicit authority", () => {
  const authority = nativeAuthority();
  expect(prepareClaudeNativeAllowList({ allow: ["Read", "Bash", "Bash(bun unrelated.ts)", "Bash(aidlc engine *)", "Bash(git status)", "Write"], authority })).toEqual({ kind: "prepared", allow: ["Read", "Bash(git status)", "Write", "Bash(aidlc engine *)", "Bash(aidlc doctor)"] });
  expect(authority.trustedCommand.mock.calls).toEqual([[{ args: "*" }]]);
  expect(authority.dispatcherCommands.mock.calls).toEqual([[]]);
});

test("native exact prefix rules retain legitimate near matches", () => {
  const authority = nativeAuthority();
  expect(prepareClaudeNativeAllowList({ allow: ["Bash(bun)", "Bash(aidlc)", "Bash(bun-extra test)", "Bash(AIDLC doctor)", " Bash(bun x)"], authority })).toEqual({ kind: "prepared", allow: ["Bash(bun)", "Bash(aidlc)", "Bash(bun-extra test)", "Bash(AIDLC doctor)", " Bash(bun x)", "Bash(aidlc engine *)", "Bash(aidlc doctor)"] });
});

test("native empty input still receives canonical authority", () => {
  const authority = nativeAuthority();
  expect(prepareClaudeNativeAllowList({ allow: [], authority })).toEqual({ kind: "prepared", allow: ["Bash(aidlc engine *)", "Bash(aidlc doctor)"] });
  expect(authority.trustedCommand.mock.calls).toEqual([[{ args: "*" }]]);
  expect(authority.dispatcherCommands.mock.calls).toEqual([[]]);
});

const NATIVE_REFUSALS: readonly { name: string; allow: unknown }[] = [
  { name: "undefined", allow: undefined }, { name: "null", allow: null }, { name: "number", allow: 0 }, { name: "boolean", allow: false }, { name: "string", allow: "Read" }, { name: "object", allow: {} },
];

test.each([...NATIVE_REFUSALS])("native malformed allow refuses before authority: $name", ({ allow }) => {
  const authority = nativeAuthority();
  expect(prepareClaudeNativeAllowList({ allow, authority })).toEqual({ kind: "refused", message: "[claude] settings.json has no permissions.allow list" });
  expect(authority.trustedCommand.mock.calls).toEqual([]);
  expect(authority.dispatcherCommands.mock.calls).toEqual([]);
});

test("native retains frozen nonstring entries by identity", () => {
  const authority = nativeAuthority();
  const kept = Object.freeze({ unknown: "field" });
  const input = Object.freeze([kept, null, false, 7, "Bash"]);
  const prepared = prepareClaudeNativeAllowList({ allow: input, authority });
  const allow: unknown = Reflect.get(prepared, "allow");
  expect(allow).toContain(kept);
  expect(prepared).toEqual({ kind: "prepared", allow: [kept, null, false, 7, "Bash(aidlc engine *)", "Bash(aidlc doctor)"] });
  expect(input).toEqual([kept, null, false, 7, "Bash"]);
});
