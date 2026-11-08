import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import { nativeCommandName, commandFilePath } from "../../../projection/domain/native-command.ts";
import { claudeCommandPath } from "./command-renderer.ts";

test("Claude commands belong under its admitted native skills directory", () => {
  expect(claudeCommandPath({ name: accept(nativeCommandName("aidlc-example")),
    within: accept(commandFilePath("agents/guard.yaml")),
    content: { kind: "text", text: "Companion" }, mode: "regular" }))
    .toEqual(accepted(path(".claude/skills/aidlc-example/agents/guard.yaml")));
});
