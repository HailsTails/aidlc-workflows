import { afterEach, describe, expect, test } from "bun:test";
import { bindCandidateRuntime, cleanupWorkflowFixtures, createCandidateFixture, fixturePathStatus } from "./workflow-candidate-fixtures.ts";

describe("workflow candidate fixture lifetime", () => {
  afterEach(cleanupWorkflowFixtures);

  test("nested runtime bindings restore the original environment and remove owned roots", () => {
    const environmentBefore = { ...process.env };
    const firstFixture = createCandidateFixture("first-cleanup");
    const secondFixture = createCandidateFixture("second-cleanup", ".codex");
    bindCandidateRuntime(firstFixture);
    const secondBindings = bindCandidateRuntime(secondFixture);
    expect(process.env).toMatchObject(secondBindings);
    expect(fixturePathStatus({ root: firstFixture.root })).toBe("present");
    expect(fixturePathStatus({ root: secondFixture.root })).toBe("present");
    cleanupWorkflowFixtures();
    expect(process.env).toEqual(environmentBefore);
    expect(fixturePathStatus({ root: firstFixture.root })).toBe("absent");
    expect(fixturePathStatus({ root: secondFixture.root })).toBe("absent");
  });
});
