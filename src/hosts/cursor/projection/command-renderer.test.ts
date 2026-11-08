import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import { commandFilePath, nativeCommandName } from "../../../projection/domain/native-command.ts";
import { cursorCommandPath } from "./command-renderer.ts";

test("Cursor places a stage command in its native skills directory", () => {
  expect(cursorCommandPath({ name: accept(nativeCommandName("aidlc-code-generation")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Stage command" }, mode: "regular" }))
    .toEqual(accepted(path(".cursor/skills/aidlc-code-generation/SKILL.md")));
});

test("Cursor places a scope command without renaming its admitted native name", () => {
  expect(cursorCommandPath({ name: accept(nativeCommandName("aidlc-feature")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Scope command" }, mode: "regular" }))
    .toEqual(accepted(path(".cursor/skills/aidlc-feature/SKILL.md")));
});

test("Cursor places the initialization shortcut beside stage and scope commands", () => {
  expect(cursorCommandPath({ name: accept(nativeCommandName("aidlc-init")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Initialization" }, mode: "regular" }))
    .toEqual(accepted(path(".cursor/skills/aidlc-init/SKILL.md")));
});

test("Cursor places the compose shortcut beside stage and scope commands", () => {
  expect(cursorCommandPath({ name: accept(nativeCommandName("aidlc-compose")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Compose" }, mode: "regular" }))
    .toEqual(accepted(path(".cursor/skills/aidlc-compose/SKILL.md")));
});

test("Cursor preserves an admitted nested companion path", () => {
  expect(cursorCommandPath({ name: accept(nativeCommandName("test-pro-example")),
    within: accept(commandFilePath("assets/example.bin")),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 128]) }, mode: "executable" }))
    .toEqual(accepted(path(".cursor/skills/test-pro-example/assets/example.bin")));
});
