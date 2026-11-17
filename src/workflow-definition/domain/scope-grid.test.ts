import { describe, expect, test } from "bun:test";
import { scope } from "../fixtures/identities.fixture.ts";
import { methodSliceFixture } from "../fixtures/method.fixture.ts";
import { scopeColumn } from "./scope-grid.ts";

type PlainColumn = { readonly scope: string; readonly stages: readonly string[] };

describe("scopeColumn", () => {
  test("lists every enabled stage the feature scope declares, in graph order", () => {
    expect(
      scopeColumn({ method: methodSliceFixture, scope: scope("feature") }),
    ).toEqual<PlainColumn>({
      scope: "feature",
      stages: ["requirements-analysis", "units-generation", "code-generation"],
    });
  });

  test("leaves out a stage the poc scope does not declare", () => {
    expect(scopeColumn({ method: methodSliceFixture, scope: scope("poc") })).toEqual<PlainColumn>({
      scope: "poc",
      stages: ["requirements-analysis", "code-generation"],
    });
  });

  test("lists no stages for a scope no stage declares", () => {
    expect(
      scopeColumn({ method: methodSliceFixture, scope: scope("test-pro-validation") }),
    ).toEqual<PlainColumn>({ scope: "test-pro-validation", stages: [] });
  });
});
