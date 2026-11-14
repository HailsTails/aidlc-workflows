import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import { commandFilePath, nativeCommandName } from "../../../projection/domain/native-command.ts";
import { kiroCommandPath } from "./command-renderer.ts";

test("Kiro CLI places a stage command in its native skills directory", () => {
  expect(kiroCommandPath({ name: accept(nativeCommandName("aidlc-code-generation")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Stage command" }, mode: "regular" }))
    .toEqual(accepted(path(".kiro/skills/aidlc-code-generation/SKILL.md")));
});

test("Kiro CLI places a scope command without renaming its admitted native name", () => {
  expect(kiroCommandPath({ name: accept(nativeCommandName("aidlc-feature")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Scope command" }, mode: "regular" }))
    .toEqual(accepted(path(".kiro/skills/aidlc-feature/SKILL.md")));
});

test("Kiro CLI places the initialization shortcut beside stage and scope commands", () => {
  expect(kiroCommandPath({ name: accept(nativeCommandName("aidlc-init")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Initialization" }, mode: "regular" }))
    .toEqual(accepted(path(".kiro/skills/aidlc-init/SKILL.md")));
});

test("Kiro CLI places the compose shortcut beside stage and scope commands", () => {
  expect(kiroCommandPath({ name: accept(nativeCommandName("aidlc-compose")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Compose" }, mode: "regular" }))
    .toEqual(accepted(path(".kiro/skills/aidlc-compose/SKILL.md")));
});

test("Kiro CLI preserves an admitted nested companion path", () => {
  expect(kiroCommandPath({ name: accept(nativeCommandName("test-pro-example")),
    within: accept(commandFilePath("assets/example.bin")),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 128]) }, mode: "executable" }))
    .toEqual(accepted(path(".kiro/skills/test-pro-example/assets/example.bin")));
});
