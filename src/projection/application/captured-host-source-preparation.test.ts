import { expect, mock, test } from "bun:test";
import { host, source } from "../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { createCapturedHostSourcePreparation } from "./captured-host-source-preparation.ts";

const identity = host({ name: "fixture", directory: ".fixture" });
const file = { source: source("hooks/aidlc-fixture-adapter.ts"), content: { kind: "text" as const,
  text: '// bun .fixture/hooks/aidlc-fixture-adapter.ts <target>\nconst invoke = "{{INVOKE}}";\n' } };
const placement = { source: file.source, destination: ".fixture/hooks/aidlc-fixture-adapter.ts",
  sourceRole: "host-adapter-script" as const };
const commands = { prefix: "native-owner", namespace: "engine", delegates: [], adapterHooks: new Set<string>(),
  trusted: (_suffix: string) => "native-owner adapter fixture", unresolvable: () => [] };

test("the source declaration binds semantic self invocation before existing token interpolation", () => {
  const trusted = mock(commands.trusted);
  const prepare = createCapturedHostSourcePreparation({ host: identity, placements: [placement], channel: "native",
    commands: { ...commands, trusted }, tokens: { ...tokenBindingsFixture({ harnessDir: ".fixture" }), ["INVOKE"]: "aidlc" } });
  expect(accept(prepare(file))).toEqual({ source: file.source, content: { kind: "text",
    text: '// native-owner adapter fixture <target>\nconst invoke = "aidlc";\n' } });
  expect(trusted).toHaveBeenCalledTimes(1);
  expect(trusted).toHaveBeenCalledWith("adapter fixture");
  expect(file.content.text).toContain("{{INVOKE}}");
});

test("matching raw text without the declared source role retains its legacy copied meaning", () => {
  const trusted = mock(commands.trusted);
  const prepare = createCapturedHostSourcePreparation({ host: identity, placements: [{ source: file.source,
    destination: placement.destination }], channel: "native", commands: { ...commands, trusted },
    tokens: { ...tokenBindingsFixture({ harnessDir: ".fixture" }), ["INVOKE"]: "aidlc" } });
  expect(accept(prepare(file)).content).toEqual({ kind: "text",
    text: '// bun .fixture/hooks/aidlc-fixture-adapter.ts <target>\nconst invoke = "aidlc";\n' });
  expect(trusted).not.toHaveBeenCalled();
});

test("a copy request preserves adapter source and performs no native route call", () => {
  const trusted = mock(commands.trusted);
  const prepare = createCapturedHostSourcePreparation({ host: identity, placements: [placement], channel: "copy",
    commands: { ...commands, trusted }, tokens: { ...tokenBindingsFixture({ harnessDir: ".fixture" }), ["INVOKE"]: "bun dispatcher" } });
  expect(accept(prepare(file)).content).toEqual({ kind: "text",
    text: '// bun .fixture/hooks/aidlc-fixture-adapter.ts <target>\nconst invoke = "bun dispatcher";\n' });
  expect(trusted).not.toHaveBeenCalled();
});
