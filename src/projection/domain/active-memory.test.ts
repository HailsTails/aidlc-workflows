import { expect, test } from "bun:test";
import { projectActiveMemoryReferences } from "./active-memory.ts";

test("every active-space memory reference uses the active-memory path", () => {
  expect(projectActiveMemoryReferences(
    "Read aidlc/spaces/<active-space>/memory/org.md and aidlc/spaces/<active-space>/memory/phases/build.md.",
  )).toBe("Read aidlc/active-memory/org.md and aidlc/active-memory/phases/build.md.");
});

test("host aliases, named spaces and unrelated text are preserved", () => {
  expect(projectActiveMemoryReferences(
    ".aidlc/rules/aidlc-org.md .aidlc/rules/team.md aidlc/spaces/default/memory/project.md aidlc/active-memory/org.md",
  )).toBe(
    ".aidlc/rules/aidlc-org.md .aidlc/rules/team.md aidlc/spaces/default/memory/project.md aidlc/active-memory/org.md",
  );
});

test("text without a reference is unchanged", () => {
  expect(projectActiveMemoryReferences("An agent with no memory reference.\n"))
    .toBe("An agent with no memory reference.\n");
  expect(projectActiveMemoryReferences("")).toBe("");
});
