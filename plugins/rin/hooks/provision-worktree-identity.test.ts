import { afterEach, describe, expect, test, vi } from "vitest";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import { adoptBotGitIdentity } from "./provision-worktree.mjs";

const paths = defaultPathOperations();
const files = defaultFileTextPort();

const createdWorktrees: string[] = [];

type WorktreeShape = {
  readonly withIdentityConfiguration: boolean;
  readonly botCliSource?: string;
};

const ADOPTING_CLI = 'process.exit(process.argv[2] === "adopt-git" ? 0 : 3);\n';

const REFUSING_CLI = "process.exit(1);\n";

const makeWorktree = ({ withIdentityConfiguration, botCliSource }: WorktreeShape): string => {
  const worktree = files.makeTemporaryDirectory(
    paths.join({ segments: [files.temporaryRoot(), "provision-identity-"] }),
  );
  createdWorktrees.push(worktree);
  files.write(paths.join({ segments: [worktree, ".git"] }), "gitdir: /nonexistent/worktree\n");
  if (withIdentityConfiguration) {
    files.mkdir(paths.join({ segments: [worktree, "aidlc"] }), { recursive: true });
    files.write(paths.join({ segments: [worktree, "aidlc", "github-identity.json"] }), "{}\n");
  }
  if (botCliSource !== undefined) {
    const toolDirectory = paths.join({ segments: [worktree, ".claude", "tools", "github-apps"] });
    files.mkdir(toolDirectory, { recursive: true });
    files.write(paths.join({ segments: [toolDirectory, "cli-main.ts"] }), botCliSource);
  }
  return worktree;
};

afterEach(() => {
  vi.restoreAllMocks();
  createdWorktrees.splice(0).forEach((worktree) => {
    files.remove(worktree, { recursive: true, force: true });
  });
});

describe("adoptBotGitIdentity", () => {
  test("skips quietly when the consumer has configured no bot identity", () => {
    const standardError = vi.spyOn(process.stderr, "write");
    const worktree = makeWorktree({ withIdentityConfiguration: false, botCliSource: ADOPTING_CLI });

    expect(adoptBotGitIdentity({ sessionDirectory: worktree })).toEqual({
      adopted: "unconfigured",
    });
    expect(standardError).not.toHaveBeenCalled();
  });

  test("skips quietly when the install does not ship the bot CLI", () => {
    const standardError = vi.spyOn(process.stderr, "write");
    const worktree = makeWorktree({ withIdentityConfiguration: true });

    expect(adoptBotGitIdentity({ sessionDirectory: worktree })).toEqual({
      adopted: "unconfigured",
    });
    expect(standardError).not.toHaveBeenCalled();
  });

  test("runs the shipped CLI's adopt-git when identity is configured", () => {
    const worktree = makeWorktree({ withIdentityConfiguration: true, botCliSource: ADOPTING_CLI });

    expect(adoptBotGitIdentity({ sessionDirectory: worktree })).toEqual({ adopted: "ok" });
  });

  test("keeps the worktree's own identity and says so when adoption is refused", () => {
    const standardError = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const worktree = makeWorktree({ withIdentityConfiguration: true, botCliSource: REFUSING_CLI });

    expect(adoptBotGitIdentity({ sessionDirectory: worktree })).toEqual({ adopted: "failed" });
    expect(String(standardError.mock.lastCall?.[0])).toContain(
      "Kept this worktree's own git identity",
    );
  });
});
