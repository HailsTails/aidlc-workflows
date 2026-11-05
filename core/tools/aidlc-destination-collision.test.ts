// covers: file:core/tools/aidlc-destination-collision.ts
import { expect, test } from "bun:test";
import { findDestinationCollision } from "./aidlc-destination-collision.ts";

test("insensitive identity refuses a differently cased duplicate and retains source spelling", () => {
  expect(findDestinationCollision({ candidate: ".CLAUDE", priorPaths: [".claude"], casePolicy: "case-insensitive" })).toEqual({ status: "collision", kind: "same", prior: ".claude" });
});
test("insensitive identity refuses a differently cased child of a managed root", () => {
  expect(findDestinationCollision({ candidate: ".CLAUDE/settings.json", priorPaths: [".claude"], casePolicy: "case-insensitive" })).toEqual({ status: "collision", kind: "descendant", prior: ".claude" });
});
test("insensitive identity refuses a differently cased parent of a prior destination", () => {
  expect(findDestinationCollision({ candidate: ".CLAUDE", priorPaths: [".claude/settings.json"], casePolicy: "case-insensitive" })).toEqual({ status: "collision", kind: "ancestor", prior: ".claude/settings.json" });
});
test("case-sensitive identity preserves distinct POSIX spellings", () => {
  expect(findDestinationCollision({ candidate: ".CLAUDE", priorPaths: [".claude"], casePolicy: "case-sensitive" })).toEqual({ status: "distinct" });
});
test("case-sensitive identity preserves a differently cased POSIX root", () => {
  expect(findDestinationCollision({ candidate: ".CLAUDE/settings.json", priorPaths: [".claude"], casePolicy: "case-sensitive" })).toEqual({ status: "distinct" });
});
test("case-sensitive identity still refuses an exact duplicate", () => {
  expect(findDestinationCollision({ candidate: ".claude", priorPaths: [".claude"], casePolicy: "case-sensitive" })).toEqual({ status: "collision", kind: "same", prior: ".claude" });
});
test("case-sensitive identity still refuses exact ancestry", () => {
  expect(findDestinationCollision({ candidate: ".claude/settings.json", priorPaths: [".claude"], casePolicy: "case-sensitive" })).toEqual({ status: "collision", kind: "descendant", prior: ".claude" });
});
test("shared string prefixes are not directory ancestry", () => {
  expect(findDestinationCollision({ candidate: ".CLAUDE-extra", priorPaths: [".claude"], casePolicy: "case-insensitive" })).toEqual({ status: "distinct" });
});
test("distinct sibling files remain distinct", () => {
  expect(findDestinationCollision({ candidate: ".claude/settings.local.json", priorPaths: [".claude/settings.json"], casePolicy: "case-insensitive" })).toEqual({ status: "distinct" });
});
test("the first colliding declared path is retained for diagnostics", () => {
  expect(findDestinationCollision({ candidate: ".CLAUDE/settings.json", priorPaths: ["aidlc", ".claude", ".claude/settings.json"], casePolicy: "case-insensitive" })).toEqual({ status: "collision", kind: "descendant", prior: ".claude" });
});
test("no prior destinations admit a new path", () => {
  expect(findDestinationCollision({ candidate: ".claude", priorPaths: [], casePolicy: "case-insensitive" })).toEqual({ status: "distinct" });
});
