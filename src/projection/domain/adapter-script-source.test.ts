import { expect, mock, test } from "bun:test";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { captureAdapterScript, renderAdapterScript } from "./adapter-script-source.ts";

const identity = host({ name: "fixture", directory: ".fixture" });
const source = "hooks/aidlc-fixture-adapter.ts";

test.each([
  'bun .fixture/hooks/aidlc-fixture-adapter.ts',
  'bun "$CLAUDE_PROJECT_DIR/.fixture/hooks/aidlc-fixture-adapter.ts"',
  'bun "${CLAUDE_PROJECT_DIR}/.fixture/hooks/aidlc-fixture-adapter.ts"',
  String.raw`bun \"$CLAUDE_PROJECT_DIR/.fixture/hooks/aidlc-fixture-adapter.ts\"`,
])("a declared adapter program carries its own source invocation before interpolation: %s", invocation => {
  const content = { kind: "text" as const, text: `// Usage\r\n//   ${invocation} <target>\r\nconst opaque = "kept";\r\n` };
  const script = captureAdapterScript({ host: identity, source, content });
  const trusted = mock((_suffix: string) => "native-owner adapter fixture");
  expect(renderAdapterScript({ script, channel: "copy", commands: { trusted } })).toEqual(content);
  expect(trusted).not.toHaveBeenCalled();
  expect(renderAdapterScript({ script, channel: "native", commands: { trusted } })).toEqual({ kind: "text",
    text: '// Usage\r\n//   native-owner adapter fixture <target>\r\nconst opaque = "kept";\r\n' });
  expect(trusted).toHaveBeenCalledTimes(1);
  expect(trusted).toHaveBeenCalledWith("adapter fixture");
  expect(content.text).toContain(invocation);
});

test("source ownership does not reinterpret unrelated programs or other hook references", () => {
  const content = { kind: "text" as const, text:
    'bun .other/hooks/aidlc-fixture-adapter.ts\nbun .fixture/hooks/aidlc-unknown.ts\n{{INVOKE}}\n' };
  const script = captureAdapterScript({ host: identity, source, content });
  const trusted = mock(() => "unused");
  expect(renderAdapterScript({ script, channel: "native", commands: { trusted } })).toEqual(content);
  expect(trusted).not.toHaveBeenCalled();
});

test("a captured adapter program owns its bytes across caller mutation", () => {
  const bytes = new TextEncoder().encode("// bun .fixture/hooks/aidlc-fixture-adapter.ts\n");
  const original = new Uint8Array(bytes);
  const script = captureAdapterScript({ host: identity, source, content: { kind: "bytes", bytes } });
  bytes.fill(0);
  expect(renderAdapterScript({ script, channel: "copy", commands: { trusted: () => "unused" } }))
    .toEqual({ kind: "bytes", bytes: original });
  expect(renderAdapterScript({ script, channel: "native", commands: { trusted: () => "native-owned" } }))
    .toEqual({ kind: "text", text: "// native-owned\n" });
});
