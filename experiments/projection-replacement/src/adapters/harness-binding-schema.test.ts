import { expect, test } from "bun:test";
import { harnessBindingSchema } from "./harness-binding-schema.ts";
test("Kiro identities remain distinct despite sharing a directory", () => {
  expect(harnessBindingSchema.parse({ harness: "kiro-ide", directory: ".kiro" })).toEqual({ harness: "kiro-ide", directory: ".kiro" });
});
test("a host identity cannot select another host's directory", () => {
  expect(harnessBindingSchema.safeParse({ harness: "codex", directory: ".claude" }).success).toBe(false);
});
test("extra policy fields cannot bypass the closed binding boundary", () => {
  expect(harnessBindingSchema.safeParse({ harness: "claude", directory: ".claude", grant: "all" }).success).toBe(false);
});
