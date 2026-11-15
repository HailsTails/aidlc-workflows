import { expect, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { nativePolicyFile, nativePolicyObligation, promptLines, type NativePolicyPrompt } from "./native-policy.ts";

const prompt = brand<NativePolicyPrompt>(Object.freeze({ kind: "native-policy", lines: Object.freeze(["trusted line"]), obligation: "old obligation" }));
const file = { path: path("agent.md"), content: { kind: "text" as const, text: "complete rendered bytes" },
  mode: "regular" as const, origin: { kind: "rendered" as const, concept: "agent" as const, name: "worker" } };

test("plain prompt lines and ordinary files acquire no policy authority", () => {
  const lines = ["native-looking custom data"];
  expect(promptLines(lines)).toBe(lines);
  expect(nativePolicyFile({ file, prompt: lines })).toBe(file);
  expect(nativePolicyObligation(file)).toBeUndefined();
});

test("the serializer binds an explicit owner prompt to complete path, mode and content", () => {
  const projected = nativePolicyFile({ file, prompt });
  expect(promptLines(prompt)).toEqual(["trusted line"]);
  expect(nativePolicyObligation(projected)).toBe("old obligation");
  expect(projected.content).toBe(file.content);
  expect(file.origin).toEqual({ kind: "rendered", concept: "agent", name: "worker" });
});

test.each([
  { path: path("other.md") },
  { mode: "executable" as const },
  { content: { kind: "text" as const, text: "altered bytes" } },
])("changed serialized output cannot reuse the original admission: %j", (change) => {
  expect(nativePolicyObligation({ ...nativePolicyFile({ file, prompt }), ...change })).toBeUndefined();
});

test("mutation of byte content invalidates its original admission", () => {
  const bytes = new Uint8Array([65]);
  const projected = nativePolicyFile({ file: { ...file, content: { kind: "bytes", bytes } }, prompt });
  expect(nativePolicyObligation(projected)).toBe("old obligation");
  bytes[0] = 66;
  expect(nativePolicyObligation(projected)).toBeUndefined();
});
