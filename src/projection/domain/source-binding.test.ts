import { expect, test } from "bun:test";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { bindCopiedSource } from "./source-binding.ts";

const tokens = { ...tokenBindingsFixture({ harnessDir: ".host" }),
  ["TRUSTED_NAMESPACE"]: "engine", ["OPTION_LETTERS"]: "A-D" };

test("runtime TypeScript binds invocation tokens and retains directory and option literals", () => {
  expect(bindCopiedSource({ source: "tools/run.ts", tokens, content: { kind: "text",
    text: "{{INVOKE}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}|{{HARNESS_DIR}}|{{OPTION_LETTERS}}" } }))
    .toEqual({ kind: "text", text: "bun .host/tools/aidlc.ts|bun .host/tools/|engine|{{HARNESS_DIR}}|{{OPTION_LETTERS}}" });
});

test("JSON and prose bind the five legacy token families exactly once", () => {
  expect(bindCopiedSource({ source: "hooks/config.json", tokens, content: { kind: "text",
    text: "{{HARNESS_DIR}}|{{INVOKE}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}|{{OPTION_LETTERS}}|{{SKILL_INVOKE}}" } }))
    .toEqual({ kind: "text", text: ".host|bun .host/tools/aidlc.ts|bun .host/tools/|engine|A-D|{{SKILL_INVOKE}}" });
});

test("binary sidecars retain captured bytes", () => {
  expect(bindCopiedSource({ source: "tools/data/icon.bin", tokens,
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } }))
    .toEqual({ kind: "bytes", bytes: new Uint8Array([0, 255, 10]) });
});
