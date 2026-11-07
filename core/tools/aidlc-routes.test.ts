import { expect, test } from "bun:test";
import { ROUTES, TOOLS } from "./aidlc-routes.ts";
import { scanNamespaceInvocations } from "./aidlc-command.ts";
test("shared route contract admits an authored workspace command", () => {
  expect(scanNamespaceInvocations("stage.md", "aidlc engine workspace document-input --onboard", ROUTES)).toEqual([{ file: "stage.md", line: 1, command: "aidlc engine workspace document-input", source: "aidlc", namespace: "engine", noun: "workspace", verb: "document-input", resolves: true }]);
});
test("shared route contract refuses an unknown owned route", () => {
  expect(scanNamespaceInvocations("stage.md", "aidlc engine not-a-route execute", ROUTES)).toEqual([{ file: "stage.md", line: 1, command: "aidlc engine not-a-route execute", source: "aidlc", namespace: "engine", noun: "not-a-route", verb: "execute", resolves: false }]);
});
test("unrelated prose does not become an owned command", () => {
  expect(scanNamespaceInvocations("stage.md", "Run bun example.ts and retain permissions.", ROUTES)).toEqual([]);
});
test("route contract preserves authoritative worker delegates", () => {
  expect(TOOLS.testingPosture).toBe("aidlc-testing-posture.ts");
  expect(ROUTES.find((route) => route.id === "testing-posture")?.tool).toBe("aidlc-testing-posture.ts");
});
