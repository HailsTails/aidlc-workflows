import { expect, mock, test } from "bun:test";
import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import { host, path } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { nativeLayoutFiles } from "./native-layout.ts";

const routes = (): NativeCommandRoutes => ({ prefix: "aidlc engine", namespace: "engine",
  delegates: ["doctor", "utility"], adapterHooks: new Set(["known-adapter"]),
  trusted: (suffix) => `aidlc engine ${suffix}`, unresolvable: () => [] });
const identity = host({ name: "fixture", directory: ".fixture" });
const release = { copyOnly: [], replacements: [], permissionsLine: "prefix-only" as const };
const file = (relative: string, text: string) => ({ path: path(relative), content: { kind: "text" as const, text },
  mode: "regular" as const, origin: { kind: "rendered" as const, concept: "settings" as const, name: "fixture" } });

test("copy-only files leave before rewriting while non-text bytes and executable mode remain intact", () => {
  const binary = { path: path(".fixture/payload.bin"), content: { kind: "bytes" as const,
    bytes: new Uint8Array([255, 0, 13, 10]) }, mode: "executable" as const,
    origin: { kind: "rendered" as const, concept: "settings" as const, name: "binary" } };
  expect(nativeLayoutFiles({ host: identity, routes: routes(), release: { ...release,
    copyOnly: [path(".fixture/copy.ts")] }, files: [file(".fixture/copy.ts", "{{OPTION_LETTERS}}"), binary] }))
    .toEqual(accepted([binary]));
});

test("native replacement absence names the distribution and actual missing text", () => {
  expect(nativeLayoutFiles({ host: identity, routes: routes(), release: { ...release,
    replacements: [{ from: "missing block", to: "native block" }] }, files: [file(".fixture/note.md", "untouched")] }))
    .toEqual(refused([{ kind: "native-text-not-found", distribution: identity.distribution, text: "missing block" }]));
});

test("replacement order precedes invocation projection and does not mutate captured files", () => {
  const captured = file(".fixture/note.md", "copy block");
  expect(nativeLayoutFiles({ host: identity, routes: routes(), release: { ...release,
    replacements: [{ from: "copy block", to: "bun .fixture/tools/aidlc.ts stage status" }] }, files: [captured] }))
    .toEqual(accepted([file(".fixture/note.md", "aidlc engine stage status")]));
  expect(captured.content).toEqual({ kind: "text", text: "copy block" });
});

test("leftover failures preserve tree walk order and per-file diagnostic order", () => {
  expect(nativeLayoutFiles({ host: identity, routes: routes(), release, files: [
    file(".fixture/a.md", "{{OPTION_LETTERS}}"),
    file(".fixture/a/inside.md", "aidlc engine utility x\nbun .fixture/tools/aidlc_unknown.ts"),
    file(".fixture/agents/a.json", '{"allowedCommands":["bun other/tools/x"]}'),
  ] })).toEqual(refused([
    { kind: "native-leftover", path: path(".fixture/a/inside.md"), reason: "bun invocation survived native projection" },
    { kind: "native-leftover", path: path(".fixture/a/inside.md"), reason: "retired engine alias survived native projection" },
    { kind: "native-leftover", path: path(".fixture/a.md"), reason: "unexpanded {{OPTION_LETTERS}}" },
    { kind: "native-leftover", path: path(".fixture/agents/a.json"), reason: "bun allowlist survived native projection" },
  ]));
});

test("namespace validation sees replacement text blanked with its line positions preserved", () => {
  const unresolvable = mock(() => []);
  expect(nativeLayoutFiles({ host: identity, routes: { ...routes(), unresolvable }, release: { ...release,
    replacements: [{ from: "copy block", to: "generated\npermissions" }] },
  files: [file(".fixture/note.md", "copy block\noutside")] }))
    .toEqual(accepted([file(".fixture/note.md", "generated\npermissions\noutside")]));
  expect(unresolvable).toHaveBeenCalledWith({ file: ".fixture/note.md", text: "\n\noutside" });
});

test("a namespace refusal is returned as native-leftover without rewriting its diagnostic", () => {
  expect(nativeLayoutFiles({ host: identity, routes: { ...routes(), unresolvable: () => ["note.md:1: unknown route"] },
    release, files: [file(".fixture/note.md", "aidlc engine unknown")] }))
    .toEqual(refused([{ kind: "native-leftover", path: path(".fixture/note.md"), reason: "note.md:1: unknown route" }]));
});
