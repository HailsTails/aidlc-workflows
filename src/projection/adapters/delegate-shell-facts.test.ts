import { expect, test } from "bun:test";
import { delegateShellFacts } from "./delegate-shell-facts.ts";

test("delegate facts assemble the canonical namespace, routes and workspace readers", () => {
  const facts = delegateShellFacts();
  expect(facts.engineNamespace).toBe("engine");
  expect(facts.engineRoutes).toContainEqual({ group: "top", verbs: ["status"] });
  expect(facts.dispatcherCommands).toContain("doctor");
  expect(facts.workspaceNouns).toEqual(["intent", "space"]);
  expect(facts.workspaceRead(["intent", "list"])).toBe("read");
});

test("assembled admission and trust functions retain the shipped boundaries", () => {
  const facts = delegateShellFacts();
  expect(facts.engineRouteAdmission({ admitted: { "aidlc-state.ts": ["get"] }, words: ["state", "get"] }))
    .toBe("admitted");
  expect(facts.engineRouteAdmission({ admitted: { "aidlc-state.ts": ["get"] }, words: ["state", "set"] }))
    .toBe("refused");
  expect(facts.lifecycleAdmission("bun .fixture/tools/aidlc-orchestrate.ts next")).toBe("refused");
  expect(facts.trustedCommand("stage status")).toBe("aidlc engine stage status");
});
