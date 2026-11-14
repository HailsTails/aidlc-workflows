import { expect, test } from "bun:test";
import { authoredBody } from "../fixtures/authored-body.fixture.ts";
import { stageAnchorOffset } from "./overlay-anchor-offset.ts";

const instructions = authoredBody([
  { level: 2, title: "Steps", prose: "" },
  { level: 3, title: "Step 4-8: Build", prose: "Build.\n" },
  { level: 3, title: "Step 9: Verify", prose: "Verify.\n" },
  { level: 2, title: "Sensors", prose: "Observe.\n" },
]);

test("step ranges resolve against heading boundaries without including the next step", () => {
  expect(stageAnchorOffset(instructions, { kind: "before-step", step: 6 })).toBe(9);
  expect(stageAnchorOffset(instructions, { kind: "after-step", step: 8 })).toBe(36);
  expect(stageAnchorOffset(instructions, { kind: "end-of-steps" })).toBe(63);
  expect(stageAnchorOffset(instructions, { kind: "in-section", section: "Sensors" })).toBe(83);
});

test("absent steps and sections remain unresolved", () => {
  expect(stageAnchorOffset(instructions, { kind: "after-step", step: 99 })).toBeNull();
  expect(stageAnchorOffset(instructions, { kind: "in-section", section: "Missing" })).toBeNull();
});
