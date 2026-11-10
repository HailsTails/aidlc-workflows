import { expect, test } from "bun:test";
import { codexHookTrustHash, engineNamespace, launcherGlobalFlags, legacyHookTrustHash, trustedCommand } from "./legacy-trusted-commands.ts";

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
