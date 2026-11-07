import { describe, expect, it, vi } from "vitest";
import type { GitHubCliPort } from "../../application/github-cli-port.ts";
import type { TokenMinter } from "../../application/mint-installation-token.ts";
import { fail, succeed } from "../../domain/result.ts";
import { secret } from "../../domain/secret.ts";
import type { CliDependencies } from "./cli-command.ts";
import { runCli } from "./run-cli.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const configuration = {
  repository,
  baseBranch: "main",
  roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
};

const botToken = secret("ghs_reviewer");

const fakeGitHubCli = () => ({
  run: vi.fn<GitHubCliPort["run"]>().mockResolvedValue(
    succeed({
      standardOutput: "https://github.com/HailsTails/minutesarah-shop/issues/429\n",
      standardError: "",
      exitCode: 0,
    }),
  ),
  readPullRequest: vi.fn<GitHubCliPort["readPullRequest"]>(),
  submitReview: vi.fn<GitHubCliPort["submitReview"]>(),
});

const fakeDependencies = (githubCli: GitHubCliPort = fakeGitHubCli()) => ({
  terminal: {
    commandArguments: vi.fn(),
    writeOutput: vi.fn(),
    writeError: vi.fn(),
    readInput: vi.fn<() => Promise<string>>().mockResolvedValue(""),
    finish: vi.fn(),
  },
  loadConfiguration: vi
    .fn<CliDependencies["loadConfiguration"]>()
    .mockResolvedValue(succeed(configuration)),
  tokenMinter: {
    mintInstallationToken: vi
      .fn<TokenMinter["mintInstallationToken"]>()
      .mockResolvedValue(succeed(botToken)),
  },
  connectGitHubCli: vi.fn<CliDependencies["connectGitHubCli"]>().mockReturnValue(githubCli),
  worktree: {
    readCurrentBranch: vi.fn(),
    readCheckoutKind: vi.fn(),
    readPushRemote: vi.fn(),
    configureWorktree: vi.fn(),
  },
  readBodyFile: vi.fn(),
  placeInStore: vi
    .fn<CliDependencies["placeInStore"]>()
    .mockResolvedValue({ kind: "outside-store", canonicalPath: "H:/shop/b.png" }),
  credentialHelperCommand: '!bun "cli-main.ts" git-credential --operation',
});

describe("runCli gh", () => {
  it("mints the author bot for a gh issue create", async () => {
    const dependencies = fakeDependencies();

    await runCli({
      dependencies,
      commandArguments: ["gh", "issue", "create", "--title", "Basket loses items", "-b", "Steps."],
    });

    expect(dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "author",
      appSlug: "rin-author",
      repository,
      permissions: { issues: "write" },
    });
  });

  it("hands gh the stamped write", async () => {
    const githubCli = fakeGitHubCli();

    await runCli({
      dependencies: fakeDependencies(githubCli),
      commandArguments: ["gh", "issue", "create", "--title", "Basket loses items", "-b", "Steps."],
    });

    expect(githubCli.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["issue", "create", "--title", "Basket loses items", "--body-file", "-"],
      standardInput: "<!-- rin-bot: role=author session=new-issue -->\n\nSteps.",
    });
  });

  it("accepts a -- before the gh arguments", async () => {
    const githubCli = fakeGitHubCli();

    await runCli({
      dependencies: fakeDependencies(githubCli),
      commandArguments: ["gh", "--", "pr", "ready", "4"],
    });

    expect(githubCli.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["pr", "ready", "4"],
      standardInput: undefined,
    });
  });

  it("exits with gh's own exit code", async () => {
    const githubCli = fakeGitHubCli();
    githubCli.run.mockResolvedValue(
      succeed({ standardOutput: "", standardError: "failed to upload b.png\n", exitCode: 3 }),
    );

    expect(
      await runCli({
        dependencies: fakeDependencies(githubCli),
        commandArguments: ["gh", "issue", "comment", "429", "-b", "x", "--attach", "b.png"],
      }),
    ).toBe(3);
  });

  it("relays gh's standard output even when gh fails part way", async () => {
    const githubCli = fakeGitHubCli();
    githubCli.run.mockResolvedValue(
      succeed({
        standardOutput: "https://github.com/HailsTails/minutesarah-shop/issues/429\n",
        standardError: "failed to upload b.png\n",
        exitCode: 1,
      }),
    );
    const dependencies = fakeDependencies(githubCli);

    await runCli({
      dependencies,
      commandArguments: ["gh", "issue", "comment", "429", "-b", "x", "--attach", "b.png"],
    });

    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith(
      "https://github.com/HailsTails/minutesarah-shop/issues/429\n",
    );
  });

  it("relays gh's standard error", async () => {
    const githubCli = fakeGitHubCli();
    githubCli.run.mockResolvedValue(
      succeed({ standardOutput: "", standardError: "failed to upload b.png\n", exitCode: 1 }),
    );
    const dependencies = fakeDependencies(githubCli);

    await runCli({
      dependencies,
      commandArguments: ["gh", "issue", "comment", "429", "-b", "x", "--attach", "b.png"],
    });

    expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith("failed to upload b.png\n");
  });

  it("reports a refused gh flag and exits 1", async () => {
    const dependencies = fakeDependencies();

    expect(
      await runCli({ dependencies, commandArguments: ["gh", "pr", "merge", "4", "--admin"] }),
    ).toBe(1);
    expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith(
      "--admin is refused: the wrapper pins the repository, never bypasses rulesets, never opens a browser or editor, and never posts a body it did not stamp. Drop --admin and give the text with --body or --body-file.\n",
    );
  });

  it("reports an unusable configuration before minting anything", async () => {
    const dependencies = fakeDependencies();
    dependencies.loadConfiguration.mockResolvedValue(
      fail({ kind: "configuration-unreadable", location: "file:///github-identity.json" }),
    );

    expect(await runCli({ dependencies, commandArguments: ["gh", "pr", "ready", "4"] })).toBe(1);
    expect(dependencies.tokenMinter.mintInstallationToken).not.toHaveBeenCalled();
  });
});

describe("runCli as git's credential helper", () => {
  it("tells git to stop asking when the credential helper cannot serve it", async () => {
    const dependencies = fakeDependencies();
    dependencies.terminal.readInput.mockResolvedValue("protocol=https\nhost=example.com\n");

    const exitCode = await runCli({
      dependencies,
      commandArguments: ["git-credential", "--operation", "get"],
    });

    expect(exitCode).toBe(1);
    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith("quit=true\n");
    expect(dependencies.tokenMinter.mintInstallationToken).not.toHaveBeenCalled();
  });

  it("answers git with the author token for the configured repository", async () => {
    const dependencies = fakeDependencies();
    dependencies.terminal.readInput.mockResolvedValue(
      "protocol=https\nhost=github.com\npath=HailsTails/minutesarah-shop.git\n",
    );

    await runCli({ dependencies, commandArguments: ["git-credential", "--operation", "get"] });

    expect(dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "author",
      appSlug: "rin-author",
      repository,
    });
    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith(
      "username=x-access-token\npassword=ghs_reviewer\n",
    );
  });

  it("stays silent for credential operations other than get", async () => {
    const dependencies = fakeDependencies();

    expect(
      await runCli({ dependencies, commandArguments: ["git-credential", "--operation", "store"] }),
    ).toBe(0);
    expect(dependencies.terminal.readInput).not.toHaveBeenCalled();
  });
});

describe("runCli local and refused invocations", () => {
  it("prints the provenance marker without touching GitHub", async () => {
    const dependencies = fakeDependencies();

    await runCli({
      dependencies,
      commandArguments: ["marker", "--role", "author", "--session", "s-1"],
    });

    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith(
      "<!-- rin-bot: role=author session=s-1 -->\n",
    );
    expect(dependencies.tokenMinter.mintInstallationToken).not.toHaveBeenCalled();
  });

  it("prints the provenance marker in a consumer with no identity configured", async () => {
    const dependencies = fakeDependencies();
    dependencies.loadConfiguration.mockResolvedValue(
      fail({ kind: "configuration-unreadable", location: "file:///github-identity.json" }),
    );

    expect(
      await runCli({
        dependencies,
        commandArguments: ["marker", "--role", "reviewer", "--session", "pr-6"],
      }),
    ).toBe(0);
    expect(dependencies.loadConfiguration).not.toHaveBeenCalled();
  });

  it("refuses repeated flags", async () => {
    const dependencies = fakeDependencies();

    expect(
      await runCli({
        dependencies,
        commandArguments: ["token", "--role", "author", "--role", "reviewer"],
      }),
    ).toBe(1);
    expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith(
      "--role was given more than once.\n",
    );
  });

  it("prints usage for an unknown command", async () => {
    const dependencies = fakeDependencies();

    expect(await runCli({ dependencies, commandArguments: ["deploy"] })).toBe(2);
    expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^Unknown command "deploy"\.\nUsage: /),
    );
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])(
    "treats the inherited object key %s as an unknown command",
    async (commandName) => {
      const dependencies = fakeDependencies();

      expect(await runCli({ dependencies, commandArguments: [commandName] })).toBe(2);
      expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(new RegExp(`^Unknown command "${commandName}"`)),
      );
    },
  );
});
