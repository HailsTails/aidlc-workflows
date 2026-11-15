import { assert, describe, expect, it } from "vitest";
import {
  acceptedGrantFlags,
  grantWriteArguments,
  parseGrantWrite,
  type GrantWriteVerb,
} from "./grant-write.ts";
import { fail, succeed } from "./result.ts";

const otherRepositoryIssue = "https://github.com/other/repo/issues/3";

const positionalsOf = (ghArguments: readonly string[]): readonly string[] =>
  ghArguments.slice(2).filter((argument) => !argument.startsWith("--"));

describe("parseGrantWrite", () => {
  it("reads the number and each listed flag with its value", () => {
    const write = parseGrantWrite({
      verb: "pr edit",
      tokens: ["12", "-t", "New title", "--add-label=bug", "--remove-milestone", "-B", "main"],
      files: ["a.png"],
    });

    expect(write).toEqual(
      succeed({
        verb: "pr edit",
        target: "12",
        flags: [
          { kind: "valued", name: "--title", value: "New title" },
          { kind: "valued", name: "--add-label", value: "bug" },
          { kind: "switch", name: "--remove-milestone" },
          { kind: "valued", name: "--base", value: "main" },
        ],
        files: ["a.png"],
      }),
    );
  });

  it.each([
    ["pr edit", []],
    ["pr edit", ["--title", "T"]],
    ["pr comment", ["feature/basket"]],
    ["issue edit", [otherRepositoryIssue]],
    ["issue comment", ["#3"]],
    ["issue edit", ["other/repo#3"]],
    ["pr edit", ["0"]],
    ["pr edit", ["12abc"]],
  ] as const)("refuses %s when %j does not start with the number", (verb, tokens) => {
    expect(parseGrantWrite({ verb, tokens, files: ["a.png"] })).toEqual(
      fail({ kind: "gh-attach-target-not-number", verb }),
    );
  });

  it.each([
    ["issue edit", ["9", otherRepositoryIssue], otherRepositoryIssue],
    ["issue edit", ["9", "10"], "10"],
    ["issue edit", ["9", "--parent", "12"], "--parent"],
    ["issue edit", ["9", `--add-sub-issue=7,${otherRepositoryIssue}`], `--add-sub-issue=7,${otherRepositoryIssue}`],
    ["issue edit", ["9", "--add-blocked-by", otherRepositoryIssue], "--add-blocked-by"],
    ["issue edit", ["9", "--add-project", "Roadmap"], "--add-project"],
    ["issue edit", ["9", "--base", "main"], "--base"],
    ["pr edit", ["4", "--type", "Bug"], "--type"],
    ["pr edit", ["4", "-Rother/repo"], "-Rother/repo"],
    ["pr edit", ["4", "-tTitle"], "-tTitle"],
    ["pr edit", ["4", "--"], "--"],
    ["pr edit", ["4", "--remove-milestone=true"], "--remove-milestone=true"],
    ["pr comment", ["4", "--title", "T"], "--title"],
    ["pr comment", ["4", "--delete-last"], "--delete-last"],
    ["issue comment", ["9", otherRepositoryIssue], otherRepositoryIssue],
    ["issue comment", ["9", "--yes"], "--yes"],
  ] as const)("refuses %s with %j, naming %s, which is not in the verb's list", (verb, tokens, token) => {
    expect(parseGrantWrite({ verb, tokens, files: ["a.png"] })).toEqual(
      fail({ kind: "gh-attach-argument-refused", verb, token }),
    );
  });

  it.each([
    ["issue edit", ["9", "--title"], "--title"],
    ["pr edit", ["4", "--add-label", "bug", "-m"], "-m"],
  ] as const)("refuses %s with %j, whose last flag has no value", (verb, tokens, flag) => {
    expect(parseGrantWrite({ verb, tokens, files: ["a.png"] })).toEqual(
      fail({ kind: "gh-flag-value-missing", flag }),
    );
  });

  it("takes the token after a valued flag as its value, whatever it looks like", () => {
    const write = parseGrantWrite({
      verb: "issue edit",
      tokens: ["9", "--title", "--remove-milestone", "--add-label", otherRepositoryIssue],
      files: [],
    });

    assert(write.kind === "success");
    expect(write.outcome.flags).toEqual([
      { kind: "valued", name: "--title", value: "--remove-milestone" },
      { kind: "valued", name: "--add-label", value: otherRepositoryIssue },
    ]);
  });
});

describe("acceptedGrantFlags", () => {
  it.each([
    [
      "pr edit",
      [
        "--title",
        "--add-label",
        "--remove-label",
        "--add-assignee",
        "--remove-assignee",
        "--milestone",
        "--remove-milestone",
        "--base",
        "--add-reviewer",
        "--remove-reviewer",
      ],
    ],
    [
      "issue edit",
      [
        "--title",
        "--add-label",
        "--remove-label",
        "--add-assignee",
        "--remove-assignee",
        "--milestone",
        "--remove-milestone",
        "--type",
        "--remove-type",
        "--remove-parent",
      ],
    ],
    ["pr comment", ["--edit-last", "--create-if-none"]],
    ["issue comment", ["--edit-last", "--create-if-none"]],
  ] as const)("lists what %s accepts under the grant, each flag once", (verb, flags) => {
    expect(acceptedGrantFlags(verb)).toEqual(flags);
  });
});

describe("grantWriteArguments", () => {
  it("joins every value to its flag, so no value can stand alone", () => {
    const ghArguments = grantWriteArguments({
      write: {
        verb: "issue edit",
        target: "9",
        flags: [
          { kind: "valued", name: "--title", value: otherRepositoryIssue },
          { kind: "switch", name: "--remove-milestone" },
          { kind: "valued", name: "--add-label", value: "-Rework" },
        ],
        files: ["shots/a.png#Before", "b.png"],
      },
      body: "Text.",
    });

    expect(ghArguments).toEqual([
      "issue",
      "edit",
      "9",
      `--title=${otherRepositoryIssue}`,
      "--remove-milestone",
      "--add-label=-Rework",
      "--attach=shots/a.png#Before",
      "--attach=b.png",
      "--body-file=-",
    ]);
  });

  it("leaves the body flag out when there is no body", () => {
    const ghArguments = grantWriteArguments({
      write: { verb: "pr comment", target: "4", flags: [], files: ["a.png"] },
      body: undefined,
    });

    expect(ghArguments).toEqual(["pr", "comment", "4", "--attach=a.png"]);
  });

  it.each<[GrantWriteVerb, readonly string[]]>([
    ["issue edit", ["9", "--title", otherRepositoryIssue]],
    ["issue edit", ["9", "--title", "--", "--add-label", "-"]],
    ["issue edit", ["9", "--add-label", otherRepositoryIssue, "--title", "T"]],
    ["issue edit", ["9", "--remove-parent", "-t", "other/repo#3", "--milestone=v1"]],
    ["pr edit", ["4", "-B", "other:feature", "--add-reviewer", otherRepositoryIssue]],
    ["pr edit", ["4", "--title=a b c", "--remove-milestone"]],
    ["pr comment", ["4", "--edit-last", "--create-if-none"]],
    ["issue comment", ["9", "--create-if-none"]],
  ])("gives gh one positional, the number, for %s with %j", (verb, tokens) => {
    const write = parseGrantWrite({ verb, tokens, files: ["a b.png#see it", "-c.png"] });

    assert(write.kind === "success");
    expect(positionalsOf(grantWriteArguments({ write: write.outcome, body: "Text." }))).toEqual([
      write.outcome.target,
    ]);
  });
});
