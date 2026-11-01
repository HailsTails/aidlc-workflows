import { assert, describe, expect, it, vi } from "vitest";
import type { GitHubRepositoryPort } from "../../application/github-repository-port.ts";
import { succeed } from "../../domain/result.ts";
import type { CommandFlags } from "./command-flags.ts";
import { issueCommands } from "./issue-commands.ts";

const issueUrl = "https://github.com/HailsTails/minutesarah-shop/issues/429";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi.fn(),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
  openIssue: vi
    .fn<GitHubRepositoryPort["openIssue"]>()
    .mockResolvedValue(succeed({ url: issueUrl })),
  reviseIssue: vi
    .fn<GitHubRepositoryPort["reviseIssue"]>()
    .mockResolvedValue(succeed({ url: issueUrl, missingLabels: [] })),
});

const contextWith = ({
  flags,
  repositoryApi,
}: {
  readonly flags: CommandFlags;
  readonly repositoryApi: GitHubRepositoryPort;
}) => ({
  flags,
  role: "author" as const,
  repositoryApi,
  configuration: {
    repository: { owner: "HailsTails", name: "minutesarah-shop" },
    baseBranch: "main",
    roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
  },
  dependencies: {
    terminal: {
      commandArguments: vi.fn(),
      writeOutput: vi.fn(),
      writeError: vi.fn(),
      readInput: vi.fn(),
      finish: vi.fn(),
    },
    loadConfiguration: vi.fn(),
    tokenMinter: { mintInstallationToken: vi.fn() },
    connectRepository: vi.fn(),
    worktree: {
      readCurrentBranch: vi.fn(),
      readCheckoutKind: vi.fn(),
      readPushRemote: vi.fn(),
      configureWorktree: vi.fn(),
    },
    readBodyFile: vi.fn(),
    credentialHelperCommand: "",
  },
});

describe("issue", () => {
  it("opens a labelled issue as the author and prints its url", async () => {
    const repositoryApi = fakeRepositoryApi();

    const opened = await issueCommands.issue.execute(
      contextWith({
        flags: { title: "Basket loses items", body: "Steps.", label: ["bug", "stage:triage"] },
        repositoryApi,
      }),
    );

    expect(opened).toEqual(succeed({ standardOutput: `${issueUrl}\n`, standardError: "" }));
    expect(repositoryApi.openIssue).toHaveBeenCalledExactlyOnceWith({
      title: "Basket loses items",
      body: "<!-- rin-bot: role=author session=new-issue -->\n\nSteps.",
      labels: ["bug", "stage:triage"],
    });
  });

  it("opens an unlabelled issue", async () => {
    const repositoryApi = fakeRepositoryApi();

    await issueCommands.issue.execute(
      contextWith({ flags: { title: "Basket loses items", body: "Steps." }, repositoryApi }),
    );

    expect(repositoryApi.openIssue).toHaveBeenCalledWith(expect.objectContaining({ labels: [] }));
  });

  it("refuses an issue without a body", async () => {
    const opened = await issueCommands.issue.execute(
      contextWith({ flags: { title: "Basket loses items" }, repositoryApi: fakeRepositoryApi() }),
    );

    expect(opened).toEqual({ kind: "failure", reason: { kind: "body-missing" } });
  });

  it("lets --label repeat", () => {
    expect(issueCommands.issue.repeatableFlags).toEqual(["label"]);
  });
});

describe("issue-edit", () => {
  it("moves stage labels and prints the issue url", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await issueCommands["issue-edit"].execute(
      contextWith({
        flags: { issue: "429", "add-label": ["stage:build"], "remove-label": ["stage:triage"] },
        repositoryApi,
      }),
    );

    expect(revised).toEqual(succeed({ standardOutput: `${issueUrl}\n`, standardError: "" }));
    expect(repositoryApi.reviseIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 429,
      title: undefined,
      body: undefined,
      state: undefined,
      labels: { add: ["stage:build"], remove: ["stage:triage"] },
    });
  });

  it("closes an issue with an attributed body", async () => {
    const repositoryApi = fakeRepositoryApi();

    await issueCommands["issue-edit"].execute(
      contextWith({
        flags: { issue: "429", state: "closed", body: "Fixed in #430.", session: "fix-430" },
        repositoryApi,
      }),
    );

    expect(repositoryApi.reviseIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 429,
      title: undefined,
      body: "<!-- rin-bot: role=author session=fix-430 -->\n\nFixed in #430.",
      state: "closed",
      labels: { add: [], remove: [] },
    });
  });

  it("refuses a state GitHub issues do not have", async () => {
    const revised = await issueCommands["issue-edit"].execute(
      contextWith({ flags: { issue: "429", state: "merged" }, repositoryApi: fakeRepositoryApi() }),
    );

    assert(revised.kind === "failure" && revised.reason.kind === "flags-invalid");
    expect(revised.reason.issues).toContain("state");
  });

  it("refuses an edit that changes nothing", async () => {
    expect(
      await issueCommands["issue-edit"].execute(
        contextWith({ flags: { issue: "429" }, repositoryApi: fakeRepositoryApi() }),
      ),
    ).toEqual({ kind: "failure", reason: { kind: "issue-unchanged", issueNumber: 429 } });
  });

  it("warns once per label it could not remove because the repository does not have it", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.reviseIssue.mockResolvedValue(
      succeed({ url: issueUrl, missingLabels: ["stage:triag", "stage:typo"] }),
    );

    const revised = await issueCommands["issue-edit"].execute(
      contextWith({
        flags: {
          issue: "429",
          "add-label": ["stage:build"],
          "remove-label": ["stage:triag", "stage:typo"],
        },
        repositoryApi,
      }),
    );

    expect(revised).toEqual(
      succeed({
        standardOutput: `${issueUrl}\n`,
        standardError:
          'label "stage:triag" does not exist; nothing removed\nlabel "stage:typo" does not exist; nothing removed\n',
      }),
    );
  });

  it("lets --add-label and --remove-label repeat", () => {
    expect(issueCommands["issue-edit"].repeatableFlags).toEqual(["add-label", "remove-label"]);
  });
});

describe("issue command token permissions", () => {
  it.each(["issue", "issue-edit"] as const)("%s asks for an issues-only token", (commandName) => {
    expect(issueCommands[commandName].permissions).toEqual({ issues: "write" });
  });
});
