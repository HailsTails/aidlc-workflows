import { describe, expect, test } from "bun:test";
import { impactedTests } from "./test-impact.ts";

const TESTS = ["tests/unit/a.test.ts", "tests/unit/b.test.ts", "tests/unit/c.test.ts"];
const A_AND_B = ["tests/unit/a.test.ts", "tests/unit/b.test.ts"];
const REACH = {
  "tests/unit/a.test.ts": ["core/tools/lib.ts", "core/tools/init.ts"],
  "tests/unit/b.test.ts": ["core/tools/lib.ts"],
  "tests/unit/c.test.ts": ["hooks/**"],
};

const impacted = (changed: readonly string[]): readonly string[] =>
  impactedTests({ tests: TESTS, reach: REACH, changed });

describe("impactedTests", () => {
  test("a change to a file a test reaches selects that test only", () => {
    expect(impacted(["core/tools/init.ts"])).toEqual(["tests/unit/a.test.ts"]);
  });

  test("a change to a shared file selects every test that reaches it", () => {
    expect(impacted(["core/tools/lib.ts"])).toEqual(A_AND_B);
  });

  test("a directory reach selects the test for any file under it", () => {
    expect(impacted(["hooks/aidlc-x.ts"])).toEqual(["tests/unit/c.test.ts"]);
  });

  test("a change to the test itself selects it", () => {
    expect(impacted(["tests/unit/b.test.ts"])).toEqual(["tests/unit/b.test.ts"]);
  });

  test("an unknown changed path falls back to every test", () => {
    expect(impacted(["docs/guide/x.md", "src/other/y.ts"])).toEqual(TESTS);
  });

  test("red: a golden or runner change selects every test, whatever it reaches", () => {
    expect(impacted(["tests/golden/kiro.json"])).toEqual(TESTS);
    expect(impacted(["tests/run-tests.ts"])).toEqual(TESTS);
  });
});

describe("conservative impact fallback", () => {
  test("an unknown path alongside a known change cannot be dropped", () => {
    expect(impacted(["core/tools/init.ts", "src/new.ts"])).toEqual(TESTS);
  });

  test("a test with no reach record remains selected", () => {
    expect(
      impactedTests({ tests: TESTS, reach: {}, changed: ["tests/unit/a.test.ts"] }),
    ).toEqual(TESTS);
  });

  test("no changes select no tests when every reach record is present", () => {
    expect(impacted([])).toEqual([]);
  });

  test("global build and compiler inputs select every test", () => {
    expect(impacted(["scripts/package.ts"])).toEqual(TESTS);
    expect(impacted(["tsconfig.tests.json"])).toEqual(TESTS);
    expect(impacted(["bunfig.toml"])).toEqual(TESTS);
  });
});