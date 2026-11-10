import { expect, test } from "bun:test";
import { keepOwnHarnessBindings } from "./harness-bindings.ts";

const expectedHeadings = ["Claude Code", "Kiro CLI", "Kiro IDE", "Codex CLI", "Cursor", "opencode", "GitHub Copilot"];
const content = "# Protocol\n\n### Claude Code\nClaude\n### Kiro CLI\nCLI\n### Kiro IDE\nIDE\n" +
  "### Codex CLI\nCodex\n### Cursor\nCursor\n### opencode\nOpen\n### GitHub Copilot\nCopilot\n## Next\nTail\n";

test("a complete binding run retains only this host and preserves surrounding sections", () => {
  expect(keepOwnHarnessBindings({ content, expectedHeadings, ownHeading: "Claude Code", file: "protocol.md" }))
    .toEqual({ ok: true, value: "# Protocol\n\n### Claude Code\nClaude\n## Next\nTail\n" });
});

test("a later host gets its own binding with the same terminal newline", () => {
  expect(keepOwnHarnessBindings({ content, expectedHeadings, ownHeading: "opencode", file: "protocol.md" }))
    .toEqual({ ok: true, value: "# Protocol\n\n### opencode\nOpen\n## Next\nTail\n" });
});

test("headings in a fence do not create a binding run", () => {
  expect(keepOwnHarnessBindings({ content: "# Protocol\n```md\n### Claude Code\nSample\n```\n",
    expectedHeadings, ownHeading: "Claude Code", file: "protocol.md" }))
    .toEqual({ ok: true, value: "# Protocol\n```md\n### Claude Code\nSample\n```\n" });
});

test("a missing host returns the retained subject and failure text", () => {
  expect(keepOwnHarnessBindings({ content: "# Protocol\n\n### Claude Code\nC\n### Cursor\nX\n",
    expectedHeadings, ownHeading: "Claude Code", file: "protocol.md" }))
    .toEqual({ ok: false, refusal: "harness bindings: protocol.md line 3: a binding run must name each tool once " +
      "(found Claude Code, Cursor; missing Kiro CLI, Kiro IDE, Codex CLI, opencode, GitHub Copilot)." });
});

test("a host without a declared binding keeps the old permissive outcome", () => {
  expect(keepOwnHarnessBindings({ content: "### Claude Code\nOnly\n", expectedHeadings,
    ownHeading: undefined, file: "protocol.md" })).toEqual({ ok: true, value: "### Claude Code\nOnly\n" });
});

test("duplicate tool headings are refused even when every expected heading exists", () => {
  expect(keepOwnHarnessBindings({ file: "duplicate.md", ownHeading: "One", expectedHeadings: ["One", "Two"],
    content: "### One\nFirst\n### Two\nSecond\n### One\nDuplicate\n" }))
    .toEqual({ ok: false, refusal: "harness bindings: duplicate.md line 1: a binding run must name each tool once " +
      "(found One, Two, One)." });
});
