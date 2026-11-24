import { expect, mock, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { serializeNativePolicy, nativePolicyObligation, promptLines, type NativePolicyPrompt } from "./native-policy.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";

const prompt = brand<NativePolicyPrompt>(Object.freeze({ kind: "native-policy", lines: Object.freeze(["trusted line"]), obligation: "old obligation" }));
const file = { path: path("agent.md"), content: { kind: "text" as const, text: "---\ntrusted line\n---\nBody\n" },
  mode: "regular" as const, origin: { kind: "rendered" as const, concept: "agent" as const, name: "worker" } };

test("plain prompt lines and ordinary files acquire no policy authority", () => {
  const lines = ["native-looking custom data"];
  expect(promptLines(lines)).toBe(lines);
  const plainSerialization = accepted(file);
  const serialize = mock<(lines: readonly string[]) => Result<typeof file, string>>().mockReturnValue(plainSerialization);
  expect(serializeNativePolicy({ prompt: lines, serialize })).toBe(plainSerialization);
  expect(serialize).toHaveBeenCalledWith(["native-looking custom data"]);
  expect(nativePolicyObligation(file)).toBeUndefined();
});

test("the trusted serializer receives owner lines and its completed output is bound", () => {
  const serialize = mock<(lines: readonly string[]) => Result<typeof file, string>>().mockReturnValue(accepted(file));
  const projected = accept(serializeNativePolicy({ prompt, serialize }));
  expect(serialize).toHaveBeenCalledTimes(1);
  expect(serialize).toHaveBeenCalledWith(["trusted line"]);
  expect(promptLines(prompt)).toEqual(["trusted line"]);
  expect(nativePolicyObligation(projected)).toBe("old obligation");
  expect(projected.content).toBe(file.content);
  expect(file.origin).toEqual({ kind: "rendered", concept: "agent", name: "worker" });
});

test("serialization refusal passes through without constructing admission", () => {
  const failure = refused("invalid frontmatter");
  const serialize = mock<(lines: readonly string[]) => Result<typeof file, string>>().mockReturnValue(failure);
  expect(serializeNativePolicy({ prompt, serialize })).toBe(failure);
  expect(serialize).toHaveBeenCalledTimes(1);
  expect(serialize).toHaveBeenCalledWith(["trusted line"]);
});

test.each([
  { path: path("other.md") },
  { mode: "executable" as const },
  { content: { kind: "text" as const, text: "altered bytes" } },
])("changed serialized output cannot reuse the original admission: %j", (change) => {
  const serialize = mock<(lines: readonly string[]) => Result<typeof file, string>>().mockReturnValue(accepted(file));
  const projected = accept(serializeNativePolicy({ prompt, serialize }));
  expect(nativePolicyObligation({ ...projected, ...change })).toBeUndefined();
});

test("mutation of byte content invalidates its original admission", () => {
  const bytes = new Uint8Array([65]);
  const byteFile = { ...file, content: { kind: "bytes" as const, bytes } };
  const serialize = mock<(lines: readonly string[]) => Result<typeof byteFile, string>>().mockReturnValue(accepted(byteFile));
  const projected = accept(serializeNativePolicy({ prompt, serialize }));
  expect(nativePolicyObligation(projected)).toBe("old obligation");
  bytes[0] = 66;
  expect(nativePolicyObligation(projected)).toBeUndefined();
});
