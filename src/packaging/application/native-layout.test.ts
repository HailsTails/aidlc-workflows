import { expect, mock, test } from "bun:test";
import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import { host, path } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { nativeLayoutFromAuthoredFixture } from "../../projection/fixtures/legacy-authoring.fixture.ts";
import { nativeLayoutFiles as consumeNativeSources } from "./native-layout.ts";
import { brand } from "../../kernel/brand.ts";
import type { NativePolicyAdmission } from "../../projection/domain/native-policy.ts";

const routes = (): NativeCommandRoutes => ({ prefix: "aidlc engine", namespace: "engine",
  delegates: ["doctor", "utility"], adapterHooks: new Set(["known-adapter"]),
  trusted: (suffix) => `aidlc engine ${suffix}`, unresolvable: () => [] });
const identity = host({ name: "fixture", directory: ".fixture" });
const release = { copyOnly: [], replacements: [], permissions: { kind: "authored" as const } };
const file = (relative: string, text: string) => ({ path: path(relative), content: { kind: "text" as const, text },
  mode: "regular" as const, origin: { kind: "rendered" as const, concept: "settings" as const, name: "fixture" } });

const admitted = { ...file(".fixture/a.md", "generated\npermissions"), origin: {
  kind: "native-policy" as const,
  source: { kind: "rendered" as const, concept: "settings" as const, name: "fixture" },
  admission: brand<NativePolicyAdmission>({ path: path(".fixture/a.md"), mode: "regular",
    text: "generated\npermissions", obligation: "copy block" }),
} };
const admittedBinary = { ...file("payload.bin", "generated\npermissions"), origin: {
  kind: "native-policy" as const,
  source: { kind: "rendered" as const, concept: "settings" as const, name: "fixture" },
  admission: brand<NativePolicyAdmission>({ path: path("payload.bin"), mode: "regular",
    text: "generated\npermissions", obligation: "copy block" }),
} };
const policyRelease = { ...release, replacements: [{ from: "copy block", to: "generated\npermissions" }] };

test("the consumer never promotes unadmitted rendered text into authoring semantics", () => {
  const literal = file(".fixture/note.md", "TypeScript, run via bun");
  expect(consumeNativeSources({ host: identity, routes: routes(), release, files: [literal] }))
    .toEqual(accepted([literal]));
  expect(consumeNativeSources({ host: identity, routes: routes(), release,
    files: [file(".fixture/note.md", "bun .fixture/tools/aidlc.ts stage status")] }))
    .toEqual(refused([{ kind: "native-leftover", path: path(".fixture/note.md"),
      reason: "bun invocation survived native projection" }]));
  expect(consumeNativeSources({ host: identity, routes: routes(), release: policyRelease,
    files: [file(".fixture/note.md", "copy block")] }))
    .toEqual(refused([{ kind: "native-text-not-found", distribution: identity.distribution, text: "copy block" }]));
});

test("completed producer output discharges only its own obligation and leaves no admission metadata", () => {
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: policyRelease, files: [admitted] }))
    .toEqual(accepted([file(".fixture/a.md", "generated\npermissions")]));
});

test("native-looking custom output without owner evidence retains mandatory legacy refusal", () => {
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: policyRelease,
    files: [file(".fixture/a.md", "generated\npermissions")] })).toEqual(refused([
    { kind: "native-text-not-found", distribution: identity.distribution, text: "copy block" },
  ]));
});

test("an admitted class cannot discharge the next missing class", () => {
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: { ...policyRelease,
    replacements: [...policyRelease.replacements, { from: "second copy", to: "second native" }] }, files: [admitted] }))
    .toEqual(refused([{ kind: "native-text-not-found", distribution: identity.distribution, text: "second copy" }]));
});

test("copy-only filtering and legacy non-text eligibility precede admission", () => {
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: { ...policyRelease,
    copyOnly: [path(".fixture/a.md")] }, files: [admitted] }))
    .toEqual(refused([{ kind: "native-text-not-found", distribution: identity.distribution, text: "copy block" }]));
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: policyRelease,
    files: [admittedBinary] }))
    .toEqual(refused([{ kind: "native-text-not-found", distribution: identity.distribution, text: "copy block" }]));
});

test("completed and legacy replacement outputs keep identical masking with line positions", () => {
  const unresolvable = mock(() => []);
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: { ...routes(), unresolvable }, release: policyRelease, files: [admitted] }))
    .toEqual(accepted([file(".fixture/a.md", "generated\npermissions")]));
  expect(unresolvable).toHaveBeenCalledWith({ file: ".fixture/a.md", text: "\n" });
});

test("copy-only files leave before rewriting while non-text bytes and executable mode remain intact", () => {
  const binary = { path: path(".fixture/payload.bin"), content: { kind: "bytes" as const,
    bytes: new Uint8Array([255, 0, 13, 10]) }, mode: "executable" as const,
    origin: { kind: "rendered" as const, concept: "settings" as const, name: "binary" } };
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: { ...release,
    copyOnly: [path(".fixture/copy.ts")] }, files: [file(".fixture/copy.ts", "{{OPTION_LETTERS}}"), binary] }))
    .toEqual(accepted([binary]));
});

test("native replacement absence names the distribution and actual missing text", () => {
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: { ...release,
    replacements: [{ from: "missing block", to: "native block" }] }, files: [file(".fixture/note.md", "untouched")] }))
    .toEqual(refused([{ kind: "native-text-not-found", distribution: identity.distribution, text: "missing block" }]));
});

test("replacement order precedes invocation projection and does not mutate captured files", () => {
  const captured = file(".fixture/note.md", "copy block");
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release: { ...release,
    replacements: [{ from: "copy block", to: "bun .fixture/tools/aidlc.ts stage status" }] }, files: [captured] }))
    .toEqual(accepted([file(".fixture/note.md", "aidlc engine stage status")]));
  expect(captured.content).toEqual({ kind: "text", text: "copy block" });
});

test("leftover failures preserve tree walk order and per-file diagnostic order", () => {
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: routes(), release, files: [
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
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: { ...routes(), unresolvable }, release: { ...release,
    replacements: [{ from: "copy block", to: "generated\npermissions" }] },
  files: [file(".fixture/note.md", "copy block\noutside")] }))
    .toEqual(accepted([file(".fixture/note.md", "generated\npermissions\noutside")]));
  expect(unresolvable).toHaveBeenCalledWith({ file: ".fixture/note.md", text: "\n\noutside" });
});

test("a namespace refusal is returned as native-leftover without rewriting its diagnostic", () => {
  expect(nativeLayoutFromAuthoredFixture({ host: identity, routes: { ...routes(), unresolvable: () => ["note.md:1: unknown route"] },
    release, files: [file(".fixture/note.md", "aidlc engine unknown")] }))
    .toEqual(refused([{ kind: "native-leftover", path: path(".fixture/note.md"), reason: "note.md:1: unknown route" }]));
});
