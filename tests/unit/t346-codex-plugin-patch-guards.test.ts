import { describe, expect, test } from "bun:test";
import { patchMutationTargetsOf, patchWriteTargetsOf, runPluginPatchGuards } from "../../harness/codex/hooks/aidlc-codex-patch-context.ts";

const projectDir = "/fixture";
const command = [
  "*** Begin Patch",
  "*** Add File: new.ts",
  "+new",
  "*** Update File: source.ts",
  "*** Move to: protected/destination.ts",
  "@@",
  "-old",
  "+new",
  "*** Delete File: protected/deleted.ts",
  "*** End Patch",
].join("\r\n");

const patchGuardSeat = (input: { readonly protectedPath?: string }) => {
  const calls: Array<{ hook_event_name: string; tool_name: string; tool_input: { file_path: string } }> = [];
  const dispatch = (payload: string) => {
    const parsed = JSON.parse(payload);
    calls.push(parsed);
    return parsed.tool_input.file_path === input.protectedPath
      ? { code: 2, stdout: "denied", stderr: "protected" }
      : { code: 0, stdout: "", stderr: "" };
  };
  return { calls, dispatch };
};

describe("Codex plugin patch guards", () => {
  test("PreToolUse covers additions, both move paths and deletion in patch order", () => {
    expect(patchMutationTargetsOf({ command, projectDir })).toEqual([
      { path: "/fixture/new.ts", tool: "Write" },
      { path: "/fixture/source.ts", tool: "Edit" },
      { path: "/fixture/protected/destination.ts", tool: "Edit" },
      { path: "/fixture/protected/deleted.ts", tool: "Edit" },
    ]);
  });

  test.each(["protected/deleted.ts", "source.ts", "protected/destination.ts"])("denies a protected mutation at %s through the dispatch boundary", (protectedPath) => {
    const seat = patchGuardSeat({ protectedPath: "/fixture/" + protectedPath });
    const outcome = runPluginPatchGuards({
      command, projectDir, event: "PreToolUse", dispatch: seat.dispatch,
    });
    expect(outcome).toEqual({ code: 2, stdout: "denied", stderr: "protected" });
    expect(seat.calls.at(-1)).toEqual({
      hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "/fixture/" + protectedPath },
    });
  });

  test("allows unprotected mutations and dispatches every target", () => {
    const seat = patchGuardSeat({});
    expect(runPluginPatchGuards({
      command, projectDir, event: "PreToolUse", dispatch: seat.dispatch,
    })).toBeNull();
    expect(seat.calls.map((call) => call.tool_input.file_path)).toEqual([
      "/fixture/new.ts", "/fixture/source.ts", "/fixture/protected/destination.ts", "/fixture/protected/deleted.ts",
    ]);
  });

  test("PostToolUse senses only files remaining written", () => {
    expect(patchWriteTargetsOf({ command, projectDir })).toEqual([
      { path: "/fixture/new.ts", tool: "Write" },
      { path: "/fixture/protected/destination.ts", tool: "Edit" },
    ]);
    const seat = patchGuardSeat({});
    runPluginPatchGuards({
      command, projectDir, event: "PostToolUse", dispatch: seat.dispatch,
    });
    expect(seat.calls).toEqual([
      { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: "/fixture/new.ts" } },
      { hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: "/fixture/protected/destination.ts" } },
    ]);
  });

  test("absolute targets remain absolute and patch body text is not a header", () => {
    expect(patchMutationTargetsOf({ command: "*** Delete File: /protected/file.ts\n+*** Move to: ignored.ts", projectDir })).toEqual([
      { path: "/protected/file.ts", tool: "Edit" },
    ]);
  });
});
