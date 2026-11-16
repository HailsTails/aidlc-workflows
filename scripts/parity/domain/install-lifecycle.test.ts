import { describe, expect, test } from "bun:test";
import { changeBetween, lifecycleDrift, type LifecycleRecord } from "./install-lifecycle.ts";

const UNCHANGED = { added: {}, changed: {}, removed: [] };

const recorded: LifecycleRecord = {
  harness: "claude",
  release: "2.11.3",
  previousRelease: "2.11.2",
  fresh: { exitCode: 0, tree: { "README.md": "a", ".claude/agent.md": "b" } },
  refresh: { exitCode: 0, change: UNCHANGED },
  localEdit: { exitCode: 4, change: UNCHANGED, file: ".claude/agent.md", named: true },
  force: { exitCode: 0, change: UNCHANGED },
  upgrade: { exitCode: 0, change: UNCHANGED, previousExitCode: 0 },
};

describe("install lifecycle", () => {
  test("a change names what was added, what changed and what was removed", () => {
    const before = { "kept.md": "1", "edited.md": "2", "gone.md": "3" };
    const after = { "kept.md": "1", "edited.md": "9", "new.md": "4" };
    expect(changeBetween(before, after)).toEqual({
      added: { "new.md": "4" },
      changed: { "edited.md": "9" },
      removed: ["gone.md"],
    });
  });

  test("an install that matches its record has no drift", () => {
    expect(lifecycleDrift({ label: "claude", expected: recorded, actual: recorded })).toEqual([]);
  });

  test("a refresh that rewrites a file and a refusal that stops naming it are both drift", () => {
    const actual: LifecycleRecord = {
      ...recorded,
      refresh: { exitCode: 0, change: { ...UNCHANGED, changed: { "README.md": "c" } } },
      localEdit: { ...recorded.localEdit, named: false },
    };
    const drift = lifecycleDrift({ label: "claude", expected: recorded, actual });
    expect(drift.map((finding) => finding.subject)).toEqual([
      "claude refresh · README.md",
      "claude local edit names the file",
    ]);
  });

  test("an upgrade that leaves a retired file behind is drift on that file", () => {
    const retired = { ...UNCHANGED, removed: [".claude/old.md"] };
    const upgrade = { ...recorded.upgrade, change: retired };
    const expected: LifecycleRecord = { ...recorded, upgrade };
    const drift = lifecycleDrift({ label: "claude", expected, actual: recorded });
    expect(drift).toEqual([
      expect.objectContaining({ subject: "claude upgrade · .claude/old.md" }),
    ]);
  });

  test("a changed exit code is drift that says both values", () => {
    const localEdit = { ...recorded.localEdit, exitCode: 0 };
    const actual: LifecycleRecord = { ...recorded, localEdit };
    const drift = lifecycleDrift({ label: "claude", expected: recorded, actual });
    expect(drift).toEqual([
      expect.objectContaining({
        subject: "claude local edit exit code",
        violation: "is 0, recorded 4",
      }),
    ]);
  });
});
