import { expect, test } from "bun:test";
import { failureOutput } from "./failure-output.ts";

test("failure output keeps each assertion and trailing runner errors without passing cases", () => {
  const output = ["(pass) green", "Expected: left", "Received: right", "(fail) first [1ms]",
    "(skip) unavailable", "error: second assertion", "(fail) second [2ms]",
    "(pass) last green", "error: cleanup failed"].join("\n");
  const kept = failureOutput(output);
  expect(kept).toContain("Expected: left\nReceived: right\n(fail) first");
  expect(kept).toContain("error: second assertion\n(fail) second");
  expect(kept).toContain("error: cleanup failed");
  expect(kept).not.toContain("(pass)");
  expect(kept).not.toContain("(skip)");
});

test("an unnamed setup failure retains bounded raw diagnostics with explicit truncation", () => {
  const kept = failureOutput(`${"x".repeat(100000)}\nerror: no space left`);
  expect(kept).toContain("truncated");
  expect(kept).toContain("error: no space left");
  expect(kept.length).toBeLessThan(66000);
});
