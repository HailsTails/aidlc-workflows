import { expect, mock, test } from "bun:test";
import type { DelegateShellFacts } from "../../../projection/application/ports/delegate-shell.ts";
import {
  copyChannelDelegateShellDeny,
  kiroIdeDelegateShellPolicy,
  nativeDelegateShellDeny,
  riskyFormDenyLines,
  RISKY_SHELL_FORMS,
  shellDenyLines,
  splitShellDeny,
} from "./delegate-shell-deny.ts";

const facts: DelegateShellFacts = {
  engineNamespace: "engine",
  engineRoutes: [],
  dispatcherCommands: [],
  launcherGlobalFlags: [],
  workspaceNouns: [],
  workspaceRead: () => "other",
  admittedVerbs: () => ({}),
  engineRouteAdmission: () => "refused",
  lifecycleAdmission: () => "admitted",
  trustedCommand: () => "unused",
};

test("copy denies the inherited tools, engine and exact dispatcher commands in order", () => {
  expect(copyChannelDelegateShellDeny({
    facts: {
      ...facts,
      dispatcherCommands: ["--doctor", "--version"],
      admittedVerbs: () => ({ "aidlc-z.ts": ["get"], "aidlc-a.ts": ["peek"] }),
    },
    harnessDir: ".sample",
    agent: "worker",
  })).toEqual({
    match: [
      "bun .sample/tools/aidlc-*",
      "bun .sample/tools/aidlc.ts engine *",
      "bun .sample/tools/aidlc.ts --doctor",
      "bun .sample/tools/aidlc.ts --version",
    ],
    exclude: [
      "bun .sample/tools/aidlc-a.ts peek",
      "bun .sample/tools/aidlc-a.ts peek *",
      "bun .sample/tools/aidlc-z.ts get",
      "bun .sample/tools/aidlc-z.ts get *",
    ],
  });
});

test("native uses supplied admission, skips placeholders and refuses unadmitted routes", () => {
  const admittedVerbs = mock(facts.admittedVerbs).mockReturnValue({ "aidlc-state.ts": ["get"] });
  const engineRouteAdmission = mock(facts.engineRouteAdmission)
    .mockReturnValueOnce("admitted").mockReturnValueOnce("admitted").mockReturnValueOnce("refused");
  expect(nativeDelegateShellDeny({
    facts: {
      ...facts,
      engineRoutes: [
        { group: "top", verbs: ["get", "<unknown>"] },
        { group: "stage", verbs: ["read", "next"] },
      ],
      dispatcherCommands: ["--doctor"],
      admittedVerbs,
      engineRouteAdmission,
      trustedCommand: mock(facts.trustedCommand).mockReturnValueOnce("aidlc engine *").mockReturnValueOnce("aidlc engine"),

    },
    agent: "reviewer",
  })).toEqual({
    match: ["aidlc engine *", "aidlc --doctor"],
    exclude: ["aidlc engine get", "aidlc engine get *", "aidlc engine stage read", "aidlc engine stage read *"],
  });
  expect(admittedVerbs).toHaveBeenCalledWith("reviewer");
  expect(engineRouteAdmission.mock.calls).toEqual([
    [{ admitted: { "aidlc-state.ts": ["get"] }, words: ["get"] }],
    [{ admitted: { "aidlc-state.ts": ["get"] }, words: ["stage", "read"] }],
    [{ admitted: { "aidlc-state.ts": ["get"] }, words: ["stage", "next"] }],
  ]);
});

test("a mutation with arguments retains only exact queries and admitted global flags", () => {
  expect(nativeDelegateShellDeny({
    facts: {
      ...facts,
      engineRoutes: [{ group: "top", verbs: ["select", "select --json"] }],
      launcherGlobalFlags: ["--json", "--quiet"],
      engineRouteAdmission: () => "admitted",
      lifecycleAdmission: mock(facts.lifecycleAdmission)
        .mockReturnValueOnce("refused").mockReturnValueOnce("admitted").mockReturnValueOnce("admitted")
        .mockReturnValueOnce("refused").mockReturnValueOnce("refused").mockReturnValueOnce("admitted")
        .mockReturnValueOnce("refused"),
      trustedCommand: mock(facts.trustedCommand).mockReturnValueOnce("aidlc engine *").mockReturnValueOnce("aidlc engine"),
    },
    agent: "worker",
  }).exclude).toEqual([
    "aidlc engine select", "aidlc engine select --json", "aidlc engine select --json",
  ]);
});

test("workspace exclusions use only supplied read forms and the exact bare query", () => {
  expect(nativeDelegateShellDeny({
    facts: {
      ...facts,
      engineRoutes: [{ group: "intent", verbs: ["switch"] }],
      workspaceNouns: ["intent", "unrouted"],
      workspaceRead: mock(facts.workspaceRead)
        .mockReturnValueOnce("read").mockReturnValueOnce("other").mockReturnValueOnce("read").mockReturnValueOnce("other"),
      lifecycleAdmission: () => "admitted",
      trustedCommand: mock(facts.trustedCommand).mockReturnValueOnce("aidlc engine *").mockReturnValueOnce("aidlc engine"),
    },
    agent: "worker",
  }).exclude).toEqual([
    "aidlc engine intent",
    "aidlc engine intent list", "aidlc engine intent list *",
    "aidlc engine intent help", "aidlc engine intent help *",
  ]);
});

test("copy workspace commands retain utility reads even without an engine route", () => {
  expect(copyChannelDelegateShellDeny({
    facts: { ...facts, workspaceNouns: ["intent"], workspaceRead: () => "other" },
    harnessDir: ".sample",
    agent: "worker",
  }).exclude).toEqual(["bun .sample/tools/aidlc-utility.ts intent"]);
});

test("risky forms retain the shipped order and YAML newline spelling", () => {
  expect(RISKY_SHELL_FORMS).toEqual(["$", "`", ">", "<", "&", "@(", "@{", "\\n"]);
  expect(riskyFormDenyLines(["run "])).toEqual([
    "    - capability: shell", "      effect: deny", "      match:",
    '        - "run *$*"', '        - "run *`*"', '        - "run *>*"', '        - "run *<*"',
    '        - "run *&*"', '        - "run *@(*"', '        - "run *@{*"', '        - "run *\\n*"',
  ]);
});

test("split denies group by the longest matching prefix without lifting wildcards", () => {
  expect(splitShellDeny({
    match: ["run *", "run engine *", "exact"],
    exclude: ["unmatched", "run *", "run ?", "run engine read", "run engine read *", "run write"],
  })).toEqual([
    {
      match: ["run *", "run engine *", "exact"],
      exclude: ["unmatched", "run *", "run ?", "run engine read", "run engine read *", "run write", "run write *"],
    },
    { match: ["run engine read *"], exclude: ["run engine read", "run engine read *"] },
    { match: ["run write *"], exclude: ["run write"] },
  ]);
});

test("shell deny lines serialize the split rules without broadening their exclusions", () => {
  expect(shellDenyLines({ match: ["run *"], exclude: ["run read"] })).toEqual([
    "    - capability: shell", "      effect: deny", "      match:", '        - "run *"',
    "      exclude:", '        - "run read"', '        - "run read *"',
    "    - capability: shell", "      effect: deny", "      match:", '        - "run read *"',
    "      exclude:", '        - "run read"',
  ]);
});

test("the native host policy composes its supplied copy directory and risky forms", () => {
  const policy = kiroIdeDelegateShellPolicy({ facts, directory: ".renamed" });
  expect(policy.riskyForms).toEqual(["$", "`", ">", "<", "&", "@(", "@{", "\\n"]);
  expect(policy.shellDeny("worker")).toEqual([
    "    - capability: shell", "      effect: deny", "      match:",
    '        - "bun .renamed/tools/aidlc-*"', '        - "bun .renamed/tools/aidlc.ts engine *"',
    "      exclude:",
    "    - capability: shell", "      effect: deny", "      match:",
    '        - "bun .renamed/tools/aidlc*$*"', '        - "bun .renamed/tools/aidlc*`*"',
    '        - "bun .renamed/tools/aidlc*>*"', '        - "bun .renamed/tools/aidlc*<*"',
    '        - "bun .renamed/tools/aidlc*&*"', '        - "bun .renamed/tools/aidlc*@(*"',
    '        - "bun .renamed/tools/aidlc*@{*"', '        - "bun .renamed/tools/aidlc*\\n*"',
  ]);
});

test("the second sample cannot hide a mutation behind a flag value", () => {
  const lifecycleAdmission = mock(facts.lifecycleAdmission)
    .mockReturnValueOnce("admitted").mockReturnValueOnce("refused").mockReturnValueOnce("admitted");
  expect(nativeDelegateShellDeny({
    facts: {
      ...facts,
      engineRoutes: [{ group: "top", verbs: ["query"] }],
      engineRouteAdmission: () => "admitted",
      lifecycleAdmission,
      trustedCommand: mock(facts.trustedCommand).mockReturnValueOnce("aidlc engine *").mockReturnValueOnce("aidlc engine"),
    },
    agent: "worker",
  }).exclude).toEqual(["aidlc engine query"]);
  expect(lifecycleAdmission.mock.calls).toEqual([["aidlc engine query x"], ["aidlc engine query x y"], ["aidlc engine query"]]);
});
