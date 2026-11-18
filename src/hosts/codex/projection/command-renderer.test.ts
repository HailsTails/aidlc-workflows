import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import { nativeCommandName, commandFilePath } from "../../../projection/domain/native-command.ts";
import { codexCommandPath } from "./command-renderer.ts";

test("Codex stage commands belong under the project skills directory", () => {
  expect(codexCommandPath({ name: accept(nativeCommandName("aidlc-requirements-analysis")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Stage\n" }, mode: "regular" }))
    .toEqual(accepted(path(".agents/skills/aidlc-requirements-analysis/SKILL.md")));
});

test("Codex scope commands belong under the project skills directory", () => {
  expect(codexCommandPath({ name: accept(nativeCommandName("aidlc-feature")),
    within: accept(commandFilePath("SKILL.md")),
    content: { kind: "text", text: "Scope\n" }, mode: "regular" }))
    .toEqual(accepted(path(".agents/skills/aidlc-feature/SKILL.md")));
});

test("Codex explicit-invocation guards stay beside their command", () => {
  expect(codexCommandPath({ name: accept(nativeCommandName("aidlc-init")),
    within: accept(commandFilePath("agents/openai.yaml")),
    content: { kind: "text", text: "policy:\n  allow_implicit_invocation: false\n" }, mode: "regular" }))
    .toEqual(accepted(path(".agents/skills/aidlc-init/agents/openai.yaml")));
});

test("Codex placement retains nested companion paths independently of their bytes and mode", () => {
  expect(codexCommandPath({ name: accept(nativeCommandName("aidlc-compose")),
    within: accept(commandFilePath("assets/nested/companion.bin")),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 128]) }, mode: "executable" }))
    .toEqual(accepted(path(".agents/skills/aidlc-compose/assets/nested/companion.bin")));
});
