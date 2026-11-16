import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import { nativeCommandName, commandFilePath } from "../../../projection/domain/native-command.ts";
import { openCodeCommandPath } from "./command-renderer.ts";

test("OpenCode stage commands belong under the engine skills directory", () => {
  expect(openCodeCommandPath({ name: accept(nativeCommandName("aidlc-requirements-analysis")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Stage\n" }, mode: "regular" }))
    .toEqual(accepted(path(".aidlc/skills/aidlc-requirements-analysis/SKILL.md")));
});

test("OpenCode scope commands belong under the engine skills directory", () => {
  expect(openCodeCommandPath({ name: accept(nativeCommandName("aidlc-feature")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Scope\n" }, mode: "regular" }))
    .toEqual(accepted(path(".aidlc/skills/aidlc-feature/SKILL.md")));
});

test("OpenCode initialization stays a skill rather than replacing the authored native entry", () => {
  expect(openCodeCommandPath({ name: accept(nativeCommandName("aidlc-init")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Init\n" }, mode: "regular" }))
    .toEqual(accepted(path(".aidlc/skills/aidlc-init/SKILL.md")));
});

test("OpenCode composition stays under the engine skills directory", () => {
  expect(openCodeCommandPath({ name: accept(nativeCommandName("aidlc-compose")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Compose\n" }, mode: "regular" }))
    .toEqual(accepted(path(".aidlc/skills/aidlc-compose/SKILL.md")));
});

test("OpenCode placement retains nested companion paths independently of their bytes and mode", () => {
  expect(openCodeCommandPath({ name: accept(nativeCommandName("aidlc-compose")),
    within: accept(commandFilePath("assets/nested/companion.bin")),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 128]) }, mode: "executable" }))
    .toEqual(accepted(path(".aidlc/skills/aidlc-compose/assets/nested/companion.bin")));
});
