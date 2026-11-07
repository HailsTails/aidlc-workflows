import { expect, test } from "bun:test";
import { claudeDistributionDescriptionPaths } from "./distribution-description.ts";
test("declares producer metadata and authored root parts separately from projected surfaces", () => {
  expect(claudeDistributionDescriptionPaths()).toEqual([".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json"]);
});
