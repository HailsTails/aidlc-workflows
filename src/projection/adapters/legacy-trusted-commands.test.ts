import { legacyDispatcherRoutes } from "./legacy-dispatcher.ts";
import { expect, test } from "bun:test";
import { createLegacyNativeCommands, engineNamespace, launcherGlobalFlags, trustedCommand } from "./legacy-trusted-commands.ts";

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
