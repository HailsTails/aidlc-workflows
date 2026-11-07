import { describe, expect, test } from "vitest";
import { nearestCheckoutRootOf } from "./rin-checkout-root.ts";
import { pathOperationsFor } from "./rin-harness-path-operations.ts";

const portsWithGitEntries = ({ gitEntries }: { readonly gitEntries: readonly string[] }) => ({
  pathOperations: pathOperationsFor({ flavour: "posix" }),
  fileKind: {
    isFile: (path: string) => gitEntries.includes(path),
    isDirectory: () => false,
  },
});

describe("nearestCheckoutRootOf", () => {
  test("a worktree's .git file marks its root", () => {
    expect(
      nearestCheckoutRootOf({
        directory: "/main/.claude/worktrees/feature/src",
        ports: portsWithGitEntries({ gitEntries: ["/main/.claude/worktrees/feature/.git"] }),
      }),
    ).toBe("/main/.claude/worktrees/feature");
  });

  test("a directory in no checkout has no root", () => {
    expect(nearestCheckoutRootOf({ directory: "/tmp/scratch", ports: portsWithGitEntries({ gitEntries: [] }) })).toBeUndefined();
  });
});
