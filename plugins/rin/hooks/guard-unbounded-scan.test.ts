import { describe, expect, test } from "vitest";
import {
  commandInvocationPayload,
  invokeBashHook,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "guard-unbounded-scan.mjs";
const RUNTIME = "node";

const COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE =
  "find .claude/worktrees -name '*.ts'";

const allowedWithLiveHookControl = async ({
  command,
}: {
  readonly command: string;
}): Promise<{ readonly allowed: boolean; readonly controlDenied: boolean }> => {
  const allowOutcome = await invokeBashHook({
    hookFileName: HOOK,
    command,
    runtime: RUNTIME,
  });
  const controlOutcome = await invokeBashHook({
    hookFileName: HOOK,
    command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
    runtime: RUNTIME,
  });
  return {
    allowed: allowOutcome.exitCode === 0 && allowOutcome.stderr === "",
    controlDenied: controlOutcome.exitCode === 2,
  };
};

describe("guard-unbounded-scan deny path", () => {
  test("names the sanctioned alternatives when it denies", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "find .claude/worktrees -name '*.mjs'",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("Grep tool");
  });

  test("blocks an unbounded find rooted at the worktrees tree", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "find .claude/worktrees -type d",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks an unbounded find rooted at the repo root", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "find . -name '*.test.ts'",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks an unbounded find rooted at node_modules", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "find node_modules -name package.json",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks an unbounded find rooted at the home directory", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "find ~ -name '*.log'",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks grep -r and cites the measured penalty", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "grep -r EnterWorktree .claude/worktrees",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("git grep");
  });

  test("blocks a recursive ls at the repo root", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "ls -R .",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks a recursive du over the worktrees tree", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "du -sh .claude/worktrees",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks a scan hidden behind a chaining operator", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "pnpm build && find .claude/worktrees -name '*.json'",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks Get-ChildItem -Recurse issued through the PowerShell tool", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "PowerShell",
        command: "Get-ChildItem .claude/worktrees -Recurse -Filter *.mjs",
      }),
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("-Depth");
  });

  test("blocks the gci alias recursing the user profile", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "PowerShell",
        command: "gci $env:USERPROFILE -Recurse",
      }),
    });
    expect(outcome.exitCode).toBe(2);
  });
});

describe("guard-unbounded-scan binds to the resolved scan root", () => {
  const outcomeFor = async ({
    toolName,
    command,
  }: {
    readonly toolName: string;
    readonly command: string;
  }): Promise<number> => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({ toolName, command }),
    });
    return outcome.exitCode;
  };

  test("a noise-tree name inside an exclusion flag does not make a scoped scan pathological", async () => {
    expect(
      await outcomeFor({
        toolName: "Bash",
        command: "grep -rn TODO packages/kernel --exclude-dir=node_modules",
      }),
    ).toBe(0);
  });

  test("a trailing dot belonging to a different command does not condemn a scoped scan", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "grep -rl foo src && cp build/out.js .",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "grep -rn pattern packages/kernel && git add .",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "grep -rn foo packages/kernel && ls ~/downloads",
      }),
    ]);
    expect(outcomes).toEqual([0, 0, 0]);
  });

  test("a scan rooted inside one package's dependency tree is bounded, not pathological", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "find packages/kernel/node_modules/.bin -name '*.cmd'",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "find scripts/check-node_modules -type f",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "du -sh apps/task-service/node_modules",
      }),
    ]);
    expect(outcomes).toEqual([0, 0, 0]);
  });

  test("home-directory subtrees are denied however they are spelled", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: 'find "$HOME/Documents" -type f',
      }).then((code) => ({ spelling: "quoted $HOME", code })),
      outcomeFor({
        toolName: "Bash",
        command: "find ~/Documents -type f",
      }).then((code) => ({ spelling: "tilde", code })),
      outcomeFor({
        toolName: "Bash",
        command: "find /c/Users/Example -name '*.md'",
      }).then((code) => ({ spelling: "git-bash drive", code })),
      outcomeFor({
        toolName: "Bash",
        command: "ls -R $HOME/Documents",
      }).then((code) => ({ spelling: "ls -R $HOME", code })),
    ]);
    expect(outcomes).toEqual([
      { spelling: "quoted $HOME", code: 2 },
      { spelling: "tilde", code: 2 },
      { spelling: "git-bash drive", code: 2 },
      { spelling: "ls -R $HOME", code: 2 },
    ]);
  });

  test("a command prefix does not hide the scanner from the rail", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "sudo find .claude/worktrees -name x",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "time find .claude/worktrees -name x",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "env FOO=1 find .claude/worktrees -name x",
      }),
    ]);
    expect(outcomes).toEqual([2, 2, 2]);
  });

  test("a PowerShell filter value is not mistaken for a scan root", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "PowerShell",
        command: "Get-ChildItem packages/kernel -Recurse -Filter .claude",
      }),
      outcomeFor({
        toolName: "PowerShell",
        command: "Get-ChildItem packages/kernel -Recurse -Include *.ts",
      }),
    ]);
    expect(outcomes).toEqual([0, 0]);
  });

  test("a legitimate pipe after a scoped scan is unaffected", async () => {
    expect(
      await outcomeFor({
        toolName: "Bash",
        command: "find packages/kernel -name '*.ts' | head -5",
      }),
    ).toBe(0);
  });

  test("an absolute or escaped scanner path is still the scanner", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "/usr/bin/find .claude/worktrees -name x",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "\\find .claude/worktrees -name x",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "xargs find .claude/worktrees -name x",
      }),
    ]);
    expect(outcomes).toEqual([2, 2, 2]);
  });

  test("a prefix carrying its own flags does not hide the scanner", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "xargs -n1 find .claude/worktrees -name x",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "sudo -u example find .claude/worktrees -name x",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "nice -n 10 find .claude/worktrees -name x",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "env -i find .claude/worktrees -name x",
      }),
    ]);
    expect(outcomes).toEqual([2, 2, 2, 2]);
  });

  test("a scanner name appearing as an argument is not the command", async () => {
    const outcomes = await Promise.all([
      outcomeFor({ toolName: "Bash", command: "git commit -m find .claude" }),
      outcomeFor({ toolName: "Bash", command: "echo find .claude" }),
      outcomeFor({ toolName: "Bash", command: "cp find .claude" }),
      outcomeFor({ toolName: "Bash", command: "git log --grep find .claude" }),
    ]);
    expect(outcomes).toEqual([0, 0, 0, 0]);
  });

  test("a du bound is honoured as its own deny message promises", async () => {
    const outcomes = await Promise.all([
      outcomeFor({ toolName: "Bash", command: "du -d 0 .claude/worktrees" }),
      outcomeFor({
        toolName: "Bash",
        command: "du --max-depth=1 .claude/worktrees",
      }),
      outcomeFor({ toolName: "Bash", command: "du -sh .claude/worktrees" }),
    ]);
    expect(outcomes).toEqual([0, 0, 2]);
  });

  test("an unbalanced quote does not swallow a later scan", async () => {
    expect(
      await outcomeFor({
        toolName: "Bash",
        command: 'echo "unclosed && find .claude/worktrees -name x',
      }),
    ).toBe(2);
  });

  test("ordinary system directories are not noise roots", async () => {
    const outcomes = await Promise.all([
      outcomeFor({ toolName: "Bash", command: "find /etc -name x" }),
      outcomeFor({ toolName: "Bash", command: "find /usr -name x" }),
      outcomeFor({ toolName: "Bash", command: "find x/users/y -type f" }),
    ]);
    expect(outcomes).toEqual([0, 0, 0]);
  });

  test("a posix home root with no drive letter is denied", async () => {
    expect(
      await outcomeFor({
        toolName: "Bash",
        command: "find /Users/example -name x",
      }),
    ).toBe(2);
  });

  test("a dot segment anywhere in the path does not defeat the noise-root test", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "find ./.claude/worktrees -name '*.ts'",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "grep -rn EnterWorktree ./.claude/worktrees",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "find .claude/./worktrees -name '*.ts'",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "find packages/../.claude/worktrees -name '*.ts'",
      }),
    ]);
    expect(outcomes).toEqual([2, 2, 2, 2]);
  });

  test("a floor is not a ceiling", async () => {
    expect(
      await outcomeFor({
        toolName: "Bash",
        command: "find .claude/worktrees -mindepth 1 -name '*.ts'",
      }),
    ).toBe(2);
  });

  test("a drive root is denied, not just its subtrees", async () => {
    const outcomes = await Promise.all([
      outcomeFor({ toolName: "Bash", command: "find /c -name '*.md'" }),
      outcomeFor({ toolName: "Bash", command: "du -sh /c" }),
    ]);
    expect(outcomes).toEqual([2, 2]);
  });

  test("a package directory named users is not a home directory", async () => {
    const outcomes = await Promise.all([
      outcomeFor({ toolName: "Bash", command: "find packages/users -type f" }),
      outcomeFor({ toolName: "Bash", command: "grep -rn foo apps/users" }),
      outcomeFor({ toolName: "Bash", command: "du -sh src/home" }),
    ]);
    expect(outcomes).toEqual([0, 0, 0]);
  });

  test("the long-form recursive flag is not a loophole", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "grep --recursive foo .claude/worktrees",
      }),
      outcomeFor({ toolName: "Bash", command: "ls --recursive ." }),
    ]);
    expect(outcomes).toEqual([2, 2]);
  });

  test("a pipe character inside a quoted pattern does not split the segment", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: 'grep -rn "foo|bar" .claude/worktrees',
      }),
      outcomeFor({
        toolName: "Bash",
        command: 'grep -rn "foo|bar" packages/kernel',
      }),
    ]);
    expect(outcomes).toEqual([2, 0]);
  });

  test("a PowerShell include or exclude value is not mistaken for a scan root", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "PowerShell",
        command: "Get-ChildItem packages/kernel -Recurse -Exclude .claude",
      }),
      outcomeFor({
        toolName: "PowerShell",
        command: "Get-ChildItem packages/kernel -Recurse -Include .aidlc",
      }),
    ]);
    expect(outcomes).toEqual([0, 0]);
  });

  test("a filter predicate is not a bound", async () => {
    expect(
      await outcomeFor({
        toolName: "Bash",
        command: "find ~ -path '*/foo/*' -name '*.ts'",
      }),
    ).toBe(2);
  });

  test("a PowerShell path supplied after the flag is still the scan root", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "PowerShell",
        command: "Get-ChildItem -Recurse -Path .claude/worktrees",
      }),
      outcomeFor({
        toolName: "PowerShell",
        command: "Get-ChildItem -Recurse -Path packages/kernel",
      }),
    ]);
    expect(outcomes).toEqual([2, 0]);
  });

  test("a scoped scan chained after an unrelated command is judged on its own segment", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        toolName: "Bash",
        command: "git add . && grep -rn foo packages/kernel",
      }),
      outcomeFor({
        toolName: "Bash",
        command: "git add . && grep -rn foo .claude/worktrees",
      }),
    ]);
    expect(outcomes).toEqual([0, 2]);
  });
});

describe("guard-unbounded-scan fires only on the measured-pathological set", () => {
  const outcomeFor = async ({
    command,
  }: {
    readonly command: string;
  }): Promise<number> => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({ toolName: "Bash", command }),
    });
    return outcome.exitCode;
  };

  test("a scoped scan of a bounded .claude subdirectory passes", async () => {
    const outcomes = await Promise.all([
      outcomeFor({
        command:
          "grep -rlniE 'line|length' .claude/knowledge/aidlc-shared/code-discipline/",
      }),
      outcomeFor({ command: "grep -rn '^\\s*//' .claude/hooks/*.test.ts" }),
      outcomeFor({ command: "find .claude/aidlc-common/stages -name '*.md'" }),
      outcomeFor({ command: "find .claude/tools/rin-gates -name '*.ts'" }),
    ]);
    expect(outcomes).toEqual([0, 0, 0, 0]);
  });

  test("the accumulating trees are still denied", async () => {
    const outcomes = await Promise.all([
      outcomeFor({ command: "find .claude/worktrees -type d" }),
      outcomeFor({ command: "find ~/.claude/projects -name '*.jsonl'" }),
      outcomeFor({ command: "find .aidlc/worktrees -type f" }),
      outcomeFor({ command: "find node_modules -name package.json" }),
    ]);
    expect(outcomes).toEqual([2, 2, 2, 2]);
  });
});

describe("guard-unbounded-scan hands back a corrected command", () => {
  test("a denied find names a copy-ready replacement carrying its own pattern", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "find .claude/worktrees -name '*.mjs'",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("Copy-ready");
    expect(outcome.stderr).toContain("git ls-files");
    expect(outcome.stderr).toContain("*.mjs");
  });

  test("a denied grep names a copy-ready replacement carrying its own pattern", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "grep -r EnterWorktree .claude/worktrees",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("git grep -n EnterWorktree");
  });
});

describe("guard-unbounded-scan never suggests a command it would itself deny", () => {
  const stderrFor = async ({
    command,
  }: {
    readonly command: string;
  }): Promise<string> => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command,
      runtime: RUNTIME,
    });
    return outcome.stderr;
  };

  const outcomeFor = async ({
    command,
  }: {
    readonly command: string;
  }): Promise<number> => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command,
      runtime: RUNTIME,
    });
    return outcome.exitCode;
  };

  test("every suggested git command passes the rail", async () => {
    const suggestions = (
      await stderrFor({ command: "find .claude/worktrees -name '*.mjs'" })
    )
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("git "));
    const outcomes = await Promise.all(
      suggestions.map((command) => outcomeFor({ command })),
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(outcomes.every((code) => code === 0)).toBe(true);
  });

  test("a find with no name predicate still yields a usable suggestion", async () => {
    const stderr = await stderrFor({
      command: "find .claude/worktrees -type d",
    });
    expect(stderr).toContain("Copy-ready");
    expect(stderr).not.toContain("undefined");
    expect(stderr).not.toContain("[object");
  });

  test("the suggested Glob pattern would actually match what was asked for", async () => {
    const globLineFor = async ({
      command,
    }: {
      readonly command: string;
    }): Promise<string> =>
      (await stderrFor({ command }))
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("Glob tool:"))
        .join("");

    const lines = await Promise.all([
      globLineFor({ command: "find .claude/worktrees -name '*.mjs'" }),
      globLineFor({ command: "find .claude/worktrees -name '*.test.ts'" }),
      globLineFor({ command: "find .claude/worktrees -name package.json" }),
      globLineFor({ command: "find .claude/worktrees -name 'test_*'" }),
      globLineFor({ command: "find .claude/worktrees -type d" }),
    ]);

    expect(lines[0]).toContain("pattern '**/*.mjs'");
    expect(lines[1]).toContain("pattern '**/*.test.ts'");
    expect(lines[2]).toContain("pattern '**/package.json'");
    expect(lines[3]).toContain("pattern '**/test_*'");
    expect(lines[4]).toContain("pattern '**/*'");
  });

  test("a grep suggestion carries the pattern, not a path", async () => {
    const stderr = await stderrFor({
      command: "grep -rn EnterWorktree .claude/worktrees",
    });
    expect(stderr).toContain("git grep -n EnterWorktree");
    expect(stderr).not.toContain("git grep -n .claude");
  });
});

describe("guard-unbounded-scan known reach", () => {
  const outcomeFor = async ({
    command,
  }: {
    readonly command: string;
  }): Promise<number> => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({ toolName: "Bash", command }),
    });
    return outcome.exitCode;
  };

  test("a root supplied through a variable or substitution is not resolvable and passes", async () => {
    const outcomes = await Promise.all([
      outcomeFor({ command: "find $repoRoot -name '*.ts'" }),
      outcomeFor({
        command: "find $(git rev-parse --show-toplevel) -name '*.ts'",
      }),
    ]);
    expect(outcomes).toEqual([0, 0]);
  });

  test("an absolute repo-root spelling with no noise segment passes", async () => {
    expect(
      await outcomeFor({ command: 'find "H:/Development/rin" -name "*.ts"' }),
    ).toBe(0);
  });
});

describe("guard-unbounded-scan rule discrimination", () => {
  const shapeOutcome = async ({
    toolName,
    command,
  }: {
    readonly toolName: string;
    readonly command: string;
  }): Promise<number> => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({ toolName, command }),
    });
    return outcome.exitCode;
  };

  test("each scanner denies its unbounded form and allows its scoped form", async () => {
    const pairs = [
      {
        scanner: "find",
        toolName: "Bash",
        unbounded: "find .claude/worktrees -name x",
        scoped: "find .claude -maxdepth 2 -name x",
      },
      {
        scanner: "grep",
        toolName: "Bash",
        unbounded: "grep -r foo .claude/worktrees",
        scoped: "grep -rn foo packages/kernel",
      },
      {
        scanner: "du",
        toolName: "Bash",
        unbounded: "du -sh .claude/worktrees",
        scoped: "du -sh packages/kernel",
      },
      {
        scanner: "ls",
        toolName: "Bash",
        unbounded: "ls -R .",
        scoped: "ls -la .claude/hooks",
      },
      {
        scanner: "gci",
        toolName: "PowerShell",
        unbounded: "gci .claude/worktrees -Recurse",
        scoped: "gci .claude/worktrees -Recurse -Depth 1",
      },
    ];

    const outcomes = await Promise.all(
      pairs.map(async (pair) => ({
        scanner: pair.scanner,
        unbounded: await shapeOutcome({
          toolName: pair.toolName,
          command: pair.unbounded,
        }),
        scoped: await shapeOutcome({
          toolName: pair.toolName,
          command: pair.scoped,
        }),
      })),
    );

    expect(outcomes).toEqual([
      { scanner: "find", unbounded: 2, scoped: 0 },
      { scanner: "grep", unbounded: 2, scoped: 0 },
      { scanner: "du", unbounded: 2, scoped: 0 },
      { scanner: "ls", unbounded: 2, scoped: 0 },
      { scanner: "gci", unbounded: 2, scoped: 0 },
    ]);
  });
});

describe("guard-unbounded-scan pass-through path", () => {
  test("allows a find bounded by -maxdepth", async () => {
    const result = await allowedWithLiveHookControl({
      command: "find .claude -maxdepth 1 -name '*.mjs'",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a find that prunes the noise tree", async () => {
    const result = await allowedWithLiveHookControl({
      command: "find . -path ./node_modules -prune -o -name '*.ts' -print",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a find rooted at a specific package subpath", async () => {
    const result = await allowedWithLiveHookControl({
      command: "find packages/kernel -name '*.ts'",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a find rooted at a specific record dir", async () => {
    const result = await allowedWithLiveHookControl({
      command: "find aidlc/spaces/default/intents/260819-example -type f",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows git grep, the sanctioned alternative", async () => {
    const result = await allowedWithLiveHookControl({
      command: "git grep -n EnterWorktree",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows git ls-files", async () => {
    const result = await allowedWithLiveHookControl({
      command: "git ls-files .claude/hooks",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows rg, which honours ignore files by default", async () => {
    const result = await allowedWithLiveHookControl({
      command: "rg EnterWorktree .claude",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows fd, which honours ignore files by default", async () => {
    const result = await allowedWithLiveHookControl({
      command: "fd --extension mjs",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a scoped recursive grep that excludes the noise tree", async () => {
    const result = await allowedWithLiveHookControl({
      command: "grep -rn TODO packages/kernel --exclude-dir=node_modules",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a scoped recursive grep against a package subpath", async () => {
    const result = await allowedWithLiveHookControl({
      command: "grep -rn TODO packages/kernel/src",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a non-recursive grep against explicit files", async () => {
    const result = await allowedWithLiveHookControl({
      command: "grep -n matcher .claude/settings.json",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a non-recursive ls of a directory", async () => {
    const result = await allowedWithLiveHookControl({
      command: "ls -la .claude/hooks",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows Get-ChildItem -Recurse bounded by -Depth", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "PowerShell",
        command: "Get-ChildItem .claude/worktrees -Recurse -Depth 2",
      }),
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });

  test("allows Get-ChildItem -Recurse rooted at a specific package subpath", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "PowerShell",
        command: "Get-ChildItem packages/kernel -Recurse -Filter *.ts",
      }),
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });

  test("ignores non-shell tools", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "Read",
        command: "find .claude/worktrees -name '*.ts'",
      }),
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });

  test("exits without denying on empty stdin", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: "",
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });

  test("treats a Bash payload with no command as an empty command", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "Bash",
        command: "",
      }),
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });
});
