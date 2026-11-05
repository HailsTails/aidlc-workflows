import { expect, test } from "bun:test";
import { documentKey, identifierStatus, pathStatus, selectionFor } from "./model.ts";

test("source identity remains distinct from a shared document name", () => {
  expect(
    documentKey({
      source: { kind: "plugin", id: "test-pro" },
      id: "reviewer",
      kind: "agent",
      body: "Review",
      description: "Review",
      tier: "judgment",
      knowledge: [],
      hook: null,
    }),
  ).toBe("plugin:test-pro/reviewer");
});
test("path and identifier values reject traversal and invalid identifiers", () => {
  expect(pathStatus({ path: "../outside" })).toBe("unsafe");
  expect(pathStatus({ path: ".claude/agents" })).toBe("safe");
  expect(identifierStatus({ identifier: "bad:id" })).toBe("invalid");
});
test("core is selected independently of explicit plugin selection", () => {
  expect(selectionFor({ source: { kind: "core", id: "framework" }, plugins: [] })).toBe("selected");
  expect(selectionFor({ source: { kind: "plugin", id: "test-pro" }, plugins: [] })).toBe(
    "deselected",
  );
});
