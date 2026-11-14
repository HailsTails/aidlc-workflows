import { expect, test } from "bun:test";
import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import type { PayloadFile } from "../domain/payload.ts";
import { createCopyRuntimeOmissions } from "./legacy-distribution.ts";
import { copyStartsWithout, harnessChoiceTextIsPlain, sha256Bytes, writtenRootIntegration }
  from "./legacy-distribution.ts";

test("distribution compatibility keeps old-reader policy encoding and exact content hashes", () => {
  expect(writtenRootIntegration({ path: "settings.json", policy: "json-entries" })).toEqual({
    path: "settings.json", policy: "whole-file", extendedPolicy: "json-entries",
  });
  expect(sha256Bytes("abc")).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(copyStartsWithout({ policy: "json-map", optional: true })).toBe(true);
  expect(copyStartsWithout({ policy: "managed-block" })).toBe(false);
  expect(harnessChoiceTextIsPlain({ choiceName: "Editor", choiceNote: "Command line" })).toBe(true);
  expect(harnessChoiceTextIsPlain({ choiceName: "Editor\nInjected line" })).toBe(false);
});

const omissionFile = (raw: string): PayloadFile => ({ path: path(raw),
  hash: hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  content: { kind: "text", text: "content" }, mode: "regular", origin: { kind: "distribution-descriptor" } });

test("copy omissions reuse the legacy root and workspace policy over admitted payload paths", () => {
  expect(createCopyRuntimeOmissions().omitted({ ...claudeCopyPayloadFixture,
    descriptor: { ...claudeCopyPayloadFixture.descriptor, layout: {
      managedDirectories: [], rootIntegrations: [
        { path: path(".gitignore"), policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: path(".mcp.json"), policy: "json-map", key: "mcpServers", presence: "optional" },
        { path: path(".vscode/settings.json"), policy: "jsonc-settings", presence: "required" },
        { path: path("opencode.json"), policy: "json-entries", presence: "required" },
        { path: path("keep.json"), policy: "whole-file", sharing: "exclusive", presence: "required" },
      ],
    } }, files: [omissionFile(".gitignore"), omissionFile(".mcp.json"), omissionFile(".vscode/settings.json"),
      omissionFile("opencode.json"), omissionFile("keep.json"), omissionFile("aidlc/spaces/default/memory/team.md"),
      omissionFile("aidlc/spaces/default/memory/project.md"), omissionFile("aidlc/active-space"),
      omissionFile(".claude/tools/data/root-blocks/gitignore")],
  })).toEqual([path(".gitignore"), path(".mcp.json"), path(".vscode/settings.json"), path("opencode.json"),
    path("aidlc/spaces/default/memory/team.md"), path("aidlc/spaces/default/memory/project.md"), path("aidlc/active-space")]);
});

test("the omission port never invents an unshipped path", () => {
  expect(createCopyRuntimeOmissions().omitted({ ...claudeCopyPayloadFixture, files: [omissionFile("keep.json")] }))
    .toEqual([]);
});
