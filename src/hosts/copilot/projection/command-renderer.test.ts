import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import { commandFilePath, nativeCommandName } from "../../../projection/domain/native-command.ts";
import { copilotCommandPath } from "./command-renderer.ts";

test("Copilot places a stage command in its native skills directory", () => {
  expect(copilotCommandPath({ name: accept(nativeCommandName("aidlc-code-generation")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Stage command" }, mode: "regular" }))
    .toEqual(accepted(path(".github/skills/aidlc-code-generation/SKILL.md")));
});

test("Copilot places a scope command without renaming its admitted native name", () => {
  expect(copilotCommandPath({ name: accept(nativeCommandName("aidlc-feature")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Scope command" }, mode: "regular" }))
    .toEqual(accepted(path(".github/skills/aidlc-feature/SKILL.md")));
});

test("Copilot places the initialization shortcut beside stage and scope commands", () => {
  expect(copilotCommandPath({ name: accept(nativeCommandName("aidlc-init")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Initialization" }, mode: "regular" }))
    .toEqual(accepted(path(".github/skills/aidlc-init/SKILL.md")));
});

test("Copilot places the compose shortcut beside stage and scope commands", () => {
  expect(copilotCommandPath({ name: accept(nativeCommandName("aidlc-compose")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Compose" }, mode: "regular" }))
    .toEqual(accepted(path(".github/skills/aidlc-compose/SKILL.md")));
});

test("Copilot preserves an admitted nested companion path", () => {
  expect(copilotCommandPath({ name: accept(nativeCommandName("test-pro-example")),
    within: accept(commandFilePath("assets/example.bin")),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 128]) }, mode: "executable" }))
    .toEqual(accepted(path(".github/skills/test-pro-example/assets/example.bin")));
});
