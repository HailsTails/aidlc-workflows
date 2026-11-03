import { assert, describe, expect, it } from "vitest";
import { parseGhInvocation } from "./gh-invocation.ts";
import { fail } from "./result.ts";

describe("parseGhInvocation routing", () => {
  it("routes a pull request create to the author bot with a required, stamped body", () => {
    const invocation = parseGhInvocation(["pr", "create", "--title", "Basket", "--body", "Adds it."]);

    assert(invocation.kind === "success");
    expect(invocation.outcome).toEqual({
      verb: "pr create",
      route: {
        role: "author",
        permissions: undefined,
        body: "required",
        closingComment: false,
        check: "none",
      },
      target: undefined,
      passThrough: ["pr", "create", "--title", "Basket"],
      body: { kind: "inline", text: "Adds it." },
      closingComment: undefined,
      attachments: [],
      head: undefined,
      session: undefined,
      review: { event: undefined, commitSha: undefined },
    });
  });

  it.each([
    [
      ["pr", "review", "4", "--approve"],
      { role: "reviewer", permissions: undefined, body: "stamped", closingComment: false, check: "review-binding" },
    ],
    [
      ["pr", "close", "4"],
      { role: "author", permissions: undefined, body: "verbatim", closingComment: true, check: "close-guard" },
    ],
    [
      ["issue", "create", "-t", "Bug", "-b", "Steps."],
      { role: "author", permissions: { issues: "write" }, body: "required", closingComment: false, check: "none" },
    ],
    [
      ["issue", "comment", "9", "-b", "Hi."],
      {
        role: "author",
        permissions: { issues: "write", pull_requests: "write" },
        body: "required",
        closingComment: false,
        check: "none",
      },
    ],
  ])("routes %j to its role, permissions, body stamping and check", (commandArguments, route) => {
    const invocation = parseGhInvocation(commandArguments);

    assert(invocation.kind === "success");
    expect(invocation.outcome.route).toEqual(route);
  });

  it.each([
    [["pr", "view", "4"], "pr view"],
    [[], ""],
  ])("refuses %j, a verb the wrapper does not run", (commandArguments, verb) => {
    expect(parseGhInvocation(commandArguments)).toEqual(fail({ kind: "gh-verb-unsupported", verb }));
  });
});

describe("parseGhInvocation flags", () => {
  it.each([
    [["pr", "edit", "12", "--add-label", "bug"], "12"],
    [["pr", "edit", "--add-label", "bug"], undefined],
  ])("reads the target of %j from the first argument after the verb", (commandArguments, target) => {
    const invocation = parseGhInvocation(commandArguments);

    assert(invocation.kind === "success");
    expect(invocation.outcome.target).toBe(target);
  });

  it.each([
    [["pr", "create", "--repo", "other/repo"], "--repo"],
    [["pr", "create", "-R", "other/repo"], "-R"],
    [["pr", "create", "--web"], "--web"],
    [["pr", "create", "--editor"], "--editor"],
    [["pr", "merge", "4", "--admin"], "--admin"],
    [["pr", "create", "--fill"], "--fill"],
    [["issue", "create", "--template", "bug"], "--template"],
    [["pr", "merge", "4", "--repo=other/repo"], "--repo"],
  ])("refuses %j", (commandArguments, flag) => {
    expect(parseGhInvocation(commandArguments)).toEqual(fail({ kind: "gh-flag-refused", flag }));
  });

  it.each([
    [["issue", "comment", "9", "-F", "note.md"], { kind: "file", location: "note.md" }],
    [["issue", "comment", "9", "--body-file=-"], { kind: "standard-input" }],
    [["issue", "comment", "9", "--body=Hi."], { kind: "inline", text: "Hi." }],
  ])("reads the body source of %j", (commandArguments, body) => {
    const invocation = parseGhInvocation(commandArguments);

    assert(invocation.kind === "success");
    expect(invocation.outcome.body).toEqual(body);
  });

  it("refuses a body given twice", () => {
    expect(parseGhInvocation(["pr", "comment", "4", "-b", "a", "--body-file", "b.md"])).toEqual(
      fail({ kind: "gh-body-given-twice" }),
    );
  });

  it("names an owned flag left without a value", () => {
    expect(parseGhInvocation(["pr", "create", "--body"])).toEqual(
      fail({ kind: "gh-flag-value-missing", flag: "--body" }),
    );
  });

  it("observes every attachment and the head while passing them to gh", () => {
    const invocation = parseGhInvocation([
      "pr",
      "create",
      "--head",
      "feature/basket",
      "--attach",
      "a.png#Before",
      "--attach=b.png",
    ]);

    assert(invocation.kind === "success");
    expect(invocation.outcome).toEqual({
      verb: "pr create",
      route: {
        role: "author",
        permissions: undefined,
        body: "required",
        closingComment: false,
        check: "none",
      },
      target: undefined,
      passThrough: ["pr", "create", "--head", "feature/basket", "--attach", "a.png#Before", "--attach=b.png"],
      body: undefined,
      closingComment: undefined,
      attachments: ["a.png#Before", "b.png"],
      head: "feature/basket",
      session: undefined,
      review: { event: undefined, commitSha: undefined },
    });
  });

  it("takes --session out of what reaches gh", () => {
    const invocation = parseGhInvocation(["issue", "reopen", "9", "--session", "pr-6"]);

    assert(invocation.kind === "success");
    expect(invocation.outcome).toEqual({
      verb: "issue reopen",
      route: {
        role: "author",
        permissions: { issues: "write" },
        body: "verbatim",
        closingComment: false,
        check: "none",
      },
      target: "9",
      passThrough: ["issue", "reopen", "9"],
      body: undefined,
      closingComment: undefined,
      attachments: [],
      head: undefined,
      session: "pr-6",
      review: { event: undefined, commitSha: undefined },
    });
  });

  it("owns the closing comment of a close so it can be stamped", () => {
    const invocation = parseGhInvocation(["pr", "close", "4", "--comment", "Superseded.", "--delete-branch"]);

    assert(invocation.kind === "success");
    expect(invocation.outcome).toEqual({
      verb: "pr close",
      route: {
        role: "author",
        permissions: undefined,
        body: "verbatim",
        closingComment: true,
        check: "close-guard",
      },
      target: "4",
      passThrough: ["pr", "close", "4", "--delete-branch"],
      body: undefined,
      closingComment: "Superseded.",
      attachments: [],
      head: undefined,
      session: undefined,
      review: { event: undefined, commitSha: undefined },
    });
  });
});

describe("parseGhInvocation review", () => {
  it("reads one event, the commit the reviewer read, and the body", () => {
    const invocation = parseGhInvocation(["pr", "review", "4", "-r", "--commit-sha", "abc123", "-b", "Fix."]);

    assert(invocation.kind === "success");
    expect(invocation.outcome).toEqual({
      verb: "pr review",
      route: {
        role: "reviewer",
        permissions: undefined,
        body: "stamped",
        closingComment: false,
        check: "review-binding",
      },
      target: "4",
      passThrough: ["pr", "review", "4"],
      body: { kind: "inline", text: "Fix." },
      closingComment: undefined,
      attachments: [],
      head: undefined,
      session: undefined,
      review: { event: "request-changes", commitSha: "abc123" },
    });
  });

  it("treats --comment as the comment event, not a closing comment", () => {
    const invocation = parseGhInvocation(["pr", "review", "4", "--comment", "-b", "Note."]);

    assert(invocation.kind === "success");
    expect(invocation.outcome.review).toEqual({ event: "comment", commitSha: undefined });
  });

  it.each([[["pr", "review", "4"]], [["pr", "review", "4", "--approve", "--comment"]]])(
    "refuses anything but exactly one event: %j",
    (commandArguments) => {
      expect(parseGhInvocation(commandArguments)).toEqual(fail({ kind: "gh-review-event-ambiguous" }));
    },
  );

  it("refuses review flags the binding does not carry", () => {
    expect(parseGhInvocation(["pr", "review", "4", "--approve", "--body-file", "a", "x"])).toEqual(
      fail({ kind: "gh-review-flag-unsupported", token: "x" }),
    );
  });
});
