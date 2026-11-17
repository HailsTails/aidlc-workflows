import { expect, test } from "bun:test";
import { discoveredHarnesses } from "./harness-discovery.ts";
import type { Workspace } from "./ports.ts";

const workspaceWith = (files: readonly string[]): Workspace => ({
  read: () => undefined,
  write: () => undefined,
  filesMatching: ([glob]) => {
    const [head = "", tail = ""] = (glob ?? "").split("*");
    return files.filter((file) => file.startsWith(head) && file.endsWith(tail));
  },
});

test("a harness with only a registered host is discovered", () => {
  expect(discoveredHarnesses(workspaceWith(["src/hosts/claude/host-data.ts"]))).toEqual(["claude"]);
});

test("a harness with only a legacy manifest is still discovered", () => {
  expect(discoveredHarnesses(workspaceWith(["harness/codex/manifest.ts"]))).toEqual(["codex"]);
});

test("a harness with both markers is named once", () => {
  const files = ["harness/kiro/manifest.ts", "src/hosts/kiro/host-data.ts"];
  expect(discoveredHarnesses(workspaceWith(files))).toEqual(["kiro"]);
});
