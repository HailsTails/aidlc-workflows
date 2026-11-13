import { expect, test } from "bun:test";
import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { nativeInvocationText } from "./native-invocations.ts";

const routes = (): NativeCommandRoutes => ({ prefix: "aidlc engine", namespace: "engine",
  delegates: ["doctor", "utility"], adapterHooks: new Set(["known-adapter"]),
  trusted: (suffix) => `aidlc engine ${suffix}`, unresolvable: () => [] });
const identity = host({ name: "fixture", directory: ".fixture" });

test("tools, bare delegates and hooks use the supplied routes without broadening adapter membership", () => {
  expect(nativeInvocationText({ host: identity, routes: routes(), text:
    'bun .fixture/tools/aidlc.ts stage status\nbun aidlc-doctor.ts\nbun .fixture/hooks/aidlc-known-adapter.ts\nbun .fixture/hooks/aidlc-new-adapter.ts\nbun .fixture/hooks/aidlc-statusline.ts',
  })).toBe('aidlc engine stage status\naidlc engine doctor\naidlc engine adapter fixture\naidlc engine hook new-adapter\naidlc engine statusline');
});

test("utility verbs move before the generic delegate rewrite and retain trailing arguments", () => {
  expect(nativeInvocationText({ host: identity, routes: routes(), text:
    'bun .fixture/tools/aidlc-utility.ts codekb-path --json\nbun .fixture/tools/aidlc-utility.ts document-input x\nbun .fixture/tools/aidlc-utility.ts config-change --guard.plan-approval off\nbun .fixture/tools/aidlc-utility.ts config-change --unknown x',
  })).toBe('aidlc engine workspace codekb --json\naidlc engine workspace document-input x\naidlc engine config set guard.plan-approval off\naidlc engine utility config-change --unknown x');
});

test("JSON-escaped project dispatchers and hooks retain the legacy prefix distinction", () => {
  expect(nativeInvocationText({ host: identity, routes: routes(), text:
    String.raw`{"command":"bun \"$CLAUDE_PROJECT_DIR/.fixture/tools/aidlc.ts\" status","hook":"bun \"$CLAUDE_PROJECT_DIR/.fixture/hooks/aidlc-known-adapter.ts\""}`,
  })).toBe('{"command":"aidlc status","hook":"aidlc engine adapter fixture"}');
});

test("quoted tool globs and invocation tokens keep the legacy replacement order", () => {
  expect(nativeInvocationText({ host: identity, routes: routes(), text:
    "\"bun \\\\.fixture/tools/.*\"\n{{INVOKE}} {{TRUSTED_NAMESPACE}} stage status\n{{TOOL_PREFIX}}doctor\n{{OPTION_LETTERS}}",
  })).toBe('"aidlc engine .*"\naidlc engine stage status\naidlc engine doctor\n{{OPTION_LETTERS}}');
});
