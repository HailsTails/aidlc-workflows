import { legacyDispatcherRoutes } from "./legacy-dispatcher.ts";
import { expect, test } from "bun:test";
import { createLegacyNativeCommands, codexHookTrustHash, engineNamespace, launcherGlobalFlags, legacyHookTrustHash, trustedCommand } from "./legacy-trusted-commands.ts";

test("the trust bridge retains the shipped session-start identity hash", () => {
  expect(codexHookTrustHash("session_start", "aidlc engine hook session-start", 1800))
    .toBe("sha256:2b4117d0e4fefa944da660b81b311dfd50426b70b8612cf9046f1cbcf4c7f163");
});

test("the trust bridge retains matcher-bound hook identity", () => {
  expect(codexHookTrustHash("pre_tool_use", "aidlc engine hook guard-tool-call", 1800, "Bash"))
    .toBe("sha256:ee279d477415273016a8363c1f6d7d6bd08e5d2bc0bc2b442f1b78498d842121");
});

test("the named hook-trust port preserves seconds and matcher identity", () => {
  expect(legacyHookTrustHash({ event: "pre_tool_use", command: "aidlc engine hook guard-tool-call",
    timeoutSeconds: 1800, matcher: "Bash" }))
    .toBe("sha256:ee279d477415273016a8363c1f6d7d6bd08e5d2bc0bc2b442f1b78498d842121");
});

test("trusted command facts keep canonical namespace and launcher flag order", () => {
  expect(engineNamespace).toBe("engine");
  expect(launcherGlobalFlags).toEqual(["--json", "--quiet", "--no-color", "--yes", "--offline", "--verbose"]);
  expect(trustedCommand("stage status")).toBe("aidlc engine stage status");
});

test("native command validation keeps only unresolved native invocations with their original lines", () => {
  const native = createLegacyNativeCommands(legacyDispatcherRoutes());
  expect(native.prefix).toBe("aidlc engine");
  expect(native.namespace).toBe("engine");
  expect(native.trusted("stage status")).toBe("aidlc engine stage status");
  expect(native.unresolvable({ file: "fixture.md", text: "aidlc engine status\naidlc engine not-a-route" }))
    .toEqual(['fixture.md:2: unresolvable projected namespace invocation "aidlc engine not-a-route"']);
  expect(native.unresolvable({ file: "fixture.md", text: "bun .fixture/tools/aidlc.ts engine not-a-route" })).toEqual([]);
});

test("native validation uses the injected route table rather than another dispatcher import", () => {
  const native = createLegacyNativeCommands({ ...legacyDispatcherRoutes(), routes: [] });
  expect(native.unresolvable({ file: "fixture.md", text: "aidlc engine status" }))
    .toEqual(['fixture.md:1: unresolvable projected namespace invocation "aidlc engine status"']);
});
