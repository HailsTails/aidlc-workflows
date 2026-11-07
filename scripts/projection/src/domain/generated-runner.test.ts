import { expect, test } from "bun:test";
import { runnerRequestKey } from "./generated-runner.ts";
test("runner requests keep scope and stage identities distinct", () => {
  expect(runnerRequestKey({ request: { kind: "stage", slug: "bugfix" } })).toBe("stage:bugfix");
  expect(runnerRequestKey({ request: { kind: "scope", scope: "bugfix" } })).toBe("scope:bugfix");
  expect(runnerRequestKey({ request: { kind: "init" } })).toBe("init");
  expect(runnerRequestKey({ request: { kind: "compose" } })).toBe("compose");
});
