import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host, path } from "../../kernel/fixtures/values.fixture.ts";
import { admitOnboardingSource } from "./onboarding-source.ts";
import { captureLegacyOnboardingDialect, declareLegacyOnboardingFile, compiledLegacyNativeFile,
  captureLegacyNeutralDocument, declareLegacyNeutralFile } from "./legacy-native-source.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { nativeLayoutFiles } from "../../packaging/application/native-layout.ts";

const identity = host({ name: "fixture", directory: ".fixture" });
const commands = { prefix: "native-owner", namespace: "engine", delegates: ["doctor"],
  adapterHooks: new Set(["fixture-adapter"]), trusted: (suffix: string) => `native-owner ${suffix}`,
  unresolvable: () => [] };
const dialect = captureLegacyOnboardingDialect({ host: identity, commands, permissions: { kind: "authored" },
  replacements: [],
  captured: accept(admitOnboardingSource({ neutral: "Neutral", harnessSkeleton: "Host",
    hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" })) });
const file = (text: string) => ({ path: path(".fixture/onboarding.md"), mode: "regular" as const,
  content: { kind: "text" as const, text },
  origin: { kind: "rendered" as const, concept: "onboarding" as const, name: "fixture" } });

test.each([
  [String.raw`bun \"$CLAUDE_PROJECT_DIR/.fixture/tools/aidlc.ts\"`, "aidlc"],
  [String.raw`bun \"$CLAUDE_PROJECT_DIR/.fixture/hooks/aidlc-fixture-adapter.ts\"`, "native-owner adapter fixture"],
  ["bun .fixture/tools/aidlc-utility.ts codekb-path extra", "native-owner workspace codekb extra"],
  ["bun .fixture/tools/aidlc-utility.ts config-change --guard.plan-approval", "native-owner config set guard.plan-approval"],
  ["bun .fixture/tools/aidlc.ts stage status", "native-owner stage status"],
  ["bun .fixture/tools/aidlc-unknown.ts extra", "native-owner unknown extra"],
  ["bun aidlc-doctor.ts", "native-owner doctor"],
  ["bun .fixture/hooks/aidlc-statusline.ts", "native-owner statusline"],
  ["bun .fixture/hooks/aidlc-other.ts", "native-owner hook other"],
  [String.raw`"bun \\.fixture/tools/.*"`, '"native-owner .*"'],
  [String.raw`"bun \\$\\{?KIRO_PROJECT_DIR\\}?/.fixture/tools/.*"`, '"native-owner .*"'],
  ["{{INVOKE}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}", "aidlc|native-owner |engine"],
])("the admitted legacy lexical form has its literal native spelling: %s", (source, expected) => {
  const program = declareLegacyOnboardingFile({ dialect, file: file(source),
    fragments: [{ kind: "authored-onboarding", text: source }] });
  expect(compiledLegacyNativeFile(program)).toEqual(file(expected));
});

test.each([
  ["$$", "left $  right"],
  ["$&", "left {{TOOL_PREFIX}}  right"],
  ["$`", "left left   right"],
  ["$'", "left  right  right"],
  ["$1", "left $1  right"],
])("opaque token replacement retains the legacy substitution operator: %s", (prefix, expected) => {
  const source = "left {{TOOL_PREFIX}} right";
  const bound = captureLegacyOnboardingDialect({ ...dialect, commands: { ...commands, prefix } });
  const program = declareLegacyOnboardingFile({ dialect: bound, file: file(source),
    fragments: [{ kind: "authored-onboarding", text: source }] });
  expect(compiledLegacyNativeFile(program)).toEqual(file(expected));
});

test("the admitted source records legacy mentions without changing the original projected view", () => {
  const body = 'Quote: TypeScript, run via bun\r\n// bun .fixture/hooks/aidlc-fixture-adapter.ts\r\n';
  const compiled = declareLegacyOnboardingFile({ dialect, fragments: [{ kind: "authored-onboarding", text: body }],
    file: file(body) });
  expect(compiled.content).toEqual({ kind: "text", text: body });
  expect(compiled.nativeAuthoring?.occurrences.map(node => ({ meaning: node.meaning, spelling: node.spelling })))
    .toEqual([{ meaning: "hook", spelling: "bun .fixture/hooks/aidlc-fixture-adapter.ts" },
      { meaning: "tools-guidance", spelling: "TypeScript, run via bun" }]);
  expect(compiledLegacyNativeFile(compiled)).toEqual(file(
    'Quote: TypeScript sources invoked through the self-contained `aidlc` runtime\r\n// native-owner adapter fixture\r\n'));
});

test("host framing keeps column-zero context and escaped dispatcher spelling distinct", () => {
  const body = String.raw`bun \"$CLAUDE_PROJECT_DIR/.fixture/tools/aidlc.ts\"`;
  const framing = '{"command":"';
  const suffix = '"}\n';
  const compiled = declareLegacyOnboardingFile({ dialect, file: file(framing + body + suffix), fragments: [
    { kind: "host-framing", text: framing }, { kind: "authored-onboarding", text: body },
    { kind: "host-framing", text: suffix }] });
  expect(compiledLegacyNativeFile(compiled)).toEqual(file('{"command":"aidlc"}\n'));
  const quoted = '> - **bun**: Custom\r\n';
  expect(compiledLegacyNativeFile(declareLegacyOnboardingFile({ dialect, file: file(quoted),
    fragments: [{ kind: "host-framing", text: "> " }, { kind: "authored-onboarding", text: quoted.slice(2) }] })))
    .toEqual(file(quoted));
});

test("source snapshot invalidation never grants semantic authority to changed output", () => {
  const body = "bun .fixture/tools/aidlc.ts stage status\n";
  const compiled = declareLegacyOnboardingFile({ dialect, file: file(body),
    fragments: [{ kind: "authored-onboarding", text: body }] });
  expect(compiledLegacyNativeFile({ ...compiled, path: path("elsewhere.md") })).toBeUndefined();
  expect(compiledLegacyNativeFile({ ...compiled, mode: "executable" })).toBeUndefined();
  expect(compiledLegacyNativeFile({ ...compiled, content: { kind: "text", text: "changed" } })).toBeUndefined();
  expect(declareLegacyOnboardingFile({ dialect: undefined, file: file(body), fragments: [] })).toEqual(file(body));
});

test("mandatory replacement admission precedes consuming a source-compiled variant", () => {
  const body = "copy block";
  const compiled = declareLegacyOnboardingFile({ dialect, file: file(body),
    fragments: [{ kind: "authored-onboarding", text: body }] });
  const release = { copyOnly: [], replacements: [{ from: body, to: "bun .fixture/tools/aidlc.ts stage status" }],
    permissions: { kind: "authored" as const } };
  expect(nativeLayoutFiles({ host: identity, routes: commands, release, files: [compiled] }))
    .toEqual(accepted([file("native-owner stage status")]));
  expect(nativeLayoutFiles({ host: identity, routes: commands,
    release: { ...release, replacements: [{ from: "absent", to: "native" }] }, files: [compiled] }))
    .toEqual({ ok: false, refusal: [{ kind: "native-text-not-found", distribution: identity.distribution, text: "absent" }] });
});

test("compiled consumer does not rerun command recognition or erase namespace validation", () => {
  const trusted = mock(commands.trusted);
  const bound = captureLegacyOnboardingDialect({ ...dialect, commands: { ...commands, trusted } });
  const body = "bun .fixture/tools/aidlc.ts stage status";
  const compiled = declareLegacyOnboardingFile({ dialect: bound, file: file(body),
    fragments: [{ kind: "authored-onboarding", text: body }] });
  trusted.mockClear();
  const unresolvable = mock(() => ["retained diagnostic"]);
  expect(nativeLayoutFiles({ host: identity, routes: { ...commands, trusted, unresolvable },
    release: { copyOnly: [], replacements: [], permissions: { kind: "authored" } }, files: [compiled] }))
    .toEqual({ ok: false, refusal: [{ kind: "native-leftover", path: path(".fixture/onboarding.md"), reason: "retained diagnostic" }] });
  expect(trusted).not.toHaveBeenCalled();
  expect(unresolvable).toHaveBeenCalledWith({ file: ".fixture/onboarding.md", text: "native-owner stage status" });
});

test("source compilation carries ordered block occurrences while Packaging admits them globally", () => {
  const replacements = [{ from: "first", to: "second" },
    { from: "second", to: "bun .fixture/tools/aidlc.ts stage status" }];
  const trusted = mock(commands.trusted);
  const bound = captureLegacyOnboardingDialect({ ...dialect, commands: { ...commands, trusted }, replacements });
  const compiled = declareLegacyOnboardingFile({ dialect: bound, file: file("first"),
    fragments: [{ kind: "authored-onboarding", text: "first" }] });
  expect(compiled.nativeAuthoring?.replacements).toEqual([
    { from: "first", to: "second", found: true },
    { from: "second", to: "bun .fixture/tools/aidlc.ts stage status", found: true }]);
  trusted.mockClear();
  expect(nativeLayoutFiles({ host: identity, routes: { ...commands, trusted },
    release: { copyOnly: [], replacements, permissions: { kind: "authored" } }, files: [compiled] }))
    .toEqual(accepted([file("native-owner stage status")]));
  expect(trusted).not.toHaveBeenCalled();
  expect(nativeLayoutFiles({ host: identity, routes: commands,
    release: { copyOnly: [compiled.path], replacements, permissions: { kind: "authored" } }, files: [compiled] }))
    .toEqual({ ok: false, refusal: [{ kind: "native-text-not-found", distribution: identity.distribution, text: "first" }] });
});

test("a source program cannot bypass existing non-text eligibility or missing policy evidence", () => {
  const body = "bun .fixture/tools/aidlc.ts stage status";
  const binaryName = { ...file(body), path: path("payload.bin") };
  const compiled = declareLegacyOnboardingFile({ dialect, file: binaryName,
    fragments: [{ kind: "authored-onboarding", text: body }] });
  expect(nativeLayoutFiles({ host: identity, routes: commands,
    release: { copyOnly: [], replacements: [], permissions: { kind: "authored" } }, files: [compiled] }))
    .toEqual(accepted([binaryName]));
  const replacements = [{ from: "required original", to: "native-looking" }];
  const bound = captureLegacyOnboardingDialect({ ...dialect, replacements });
  const noOriginal = declareLegacyOnboardingFile({ dialect: bound, file: file("native-looking"),
    fragments: [{ kind: "authored-onboarding", text: "native-looking" }] });
  expect(nativeLayoutFiles({ host: identity, routes: commands,
    release: { copyOnly: [], replacements, permissions: { kind: "authored" } }, files: [noOriginal] }))
    .toEqual({ ok: false, refusal: [{ kind: "native-text-not-found", distribution: identity.distribution,
      text: "required original" }] });
});

test("neutral source admission owns its snapshot and declaration, not an onboarding identity", () => {
  const original = new TextEncoder().encode('User quote: TypeScript, run via bun\r\n');
  const expected = new Uint8Array(original);
  const captured = captureLegacyNeutralDocument({ context: dialect,
    captured: { source: source("knowledge/custom.md"), role: "knowledge",
      content: { kind: "bytes", bytes: original } } });
  original.fill(0);
  const view = captured.content;
  expect(view).toEqual({ kind: "bytes", bytes: expected });
  if (view.kind !== "bytes") throw new Error("The byte source must retain its representation.");
  view.bytes.fill(0);
  expect(captured.content).toEqual({ kind: "bytes", bytes: expected });
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(expected);
  const placed = { path: path(".fixture/knowledge/custom.md"), mode: "regular" as const,
    content: { kind: "text" as const, text }, origin: { kind: "neutral" as const, source: captured.source } };
  const program = declareLegacyNeutralFile({ dialect: captured.nativeDialect, file: placed,
    fragments: [{ kind: "neutral-document", text }] });
  expect(program.nativeAuthoring?.declaration).toEqual<unknown>({ kind: "neutral-document", document: {
    source: source("knowledge/custom.md"), role: "knowledge", content: { kind: "bytes", bytes: expected } } });
  expect(compiledLegacyNativeFile(program)).toEqual({ ...placed, content: { kind: "text",
    text: 'User quote: TypeScript sources invoked through the self-contained `aidlc` runtime\r\n' } });
});
