import { expect, test } from "bun:test";
import { codexHookTrust } from "./hook-trust.ts";

test("Codex retains the shipped session-start identity hash", () => {
  expect(codexHookTrust({ event: "session_start", command: "aidlc engine hook session-start",
    timeoutSeconds: 1800, matcher: undefined }))
    .toBe("sha256:2b4117d0e4fefa944da660b81b311dfd50426b70b8612cf9046f1cbcf4c7f163");
});

test("Codex retains matcher-bound hook identity", () => {
  expect(codexHookTrust({ event: "pre_tool_use", command: "aidlc engine hook guard-tool-call",
    timeoutSeconds: 1800, matcher: "Bash" }))
    .toBe("sha256:ee279d477415273016a8363c1f6d7d6bd08e5d2bc0bc2b442f1b78498d842121");
});
