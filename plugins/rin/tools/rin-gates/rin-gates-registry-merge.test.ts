import { describe, expect, test } from "vitest";
import {
  describeFailure,
  mergeRegistries,
  parseRegistry,
  type RegistryRow,
  renderRegistry,
} from "./rin-gates-registry-merge";

const rowOf = (
  overrides: Partial<RegistryRow> & { uuid: string },
): RegistryRow => ({
  slug: "some-slug",
  dirName: "260729-some-slug",
  scope: "rin-gates",
  status: "in-flight",
  ...overrides,
});

describe("parseRegistry", () => {
  test("reads a well-formed registry array", () => {
    const parsed = parseRegistry(
      '[{"uuid":"u1","slug":"a","dirName":"260729-a","scope":"rin-gates","status":"in-flight"}]',
    );
    expect(parsed).toEqual({
      outcome: "ok",
      value: [
        {
          uuid: "u1",
          slug: "a",
          dirName: "260729-a",
          scope: "rin-gates",
          status: "in-flight",
        },
      ],
    });
  });

  test("preserves the optional repos array", () => {
    const parsed = parseRegistry(
      '[{"uuid":"u1","slug":"a","status":"in-flight","repos":["rin","other"]}]',
    );
    expect(parsed).toEqual({
      outcome: "ok",
      value: [
        { uuid: "u1", slug: "a", status: "in-flight", repos: ["rin", "other"] },
      ],
    });
  });

  test("keeps a pre-spike row that omits dirName", () => {
    const parsed = parseRegistry(
      '[{"uuid":"u1","slug":"a","status":"complete"}]',
    );
    expect(parsed).toEqual({
      outcome: "ok",
      value: [{ uuid: "u1", slug: "a", status: "complete" }],
    });
  });

  test("fails on invalid JSON rather than returning an empty registry", () => {
    const parsed = parseRegistry("[{");
    expect(parsed.outcome).toBe("failed");
  });

  test("fails when the document is not an array", () => {
    expect(parseRegistry('{"uuid":"u1"}')).toEqual({
      outcome: "failed",
      error: { reason: "not-an-array" },
    });
  });

  test("fails when a row lacks its identity fields", () => {
    expect(parseRegistry('[{"slug":"a","status":"in-flight"}]')).toEqual({
      outcome: "failed",
      error: { reason: "row-missing-identity", index: 0 },
    });
  });
});

describe("mergeRegistries", () => {
  test("unions disjoint appends, ours first then theirs", () => {
    const merged = mergeRegistries({
      base: [rowOf({ uuid: "shared" })],
      ours: [rowOf({ uuid: "shared" }), rowOf({ uuid: "mine" })],
      theirs: [rowOf({ uuid: "shared" }), rowOf({ uuid: "yours" })],
    });
    expect(
      merged.outcome === "ok" && merged.value.rows.map((row) => row.uuid),
    ).toEqual(["shared", "mine", "yours"]);
  });

  test("counts what each side contributed", () => {
    const merged = mergeRegistries({
      base: [],
      ours: [rowOf({ uuid: "mine" })],
      theirs: [rowOf({ uuid: "yours" })],
    });
    expect(merged.outcome === "ok" && merged.value.summary).toEqual({
      ours: 1,
      theirs: 1,
      merged: 2,
      addedFromTheirs: 1,
      takenFromTheirs: 0,
    });
  });

  test("takes their status transition when ours is unchanged from base", () => {
    const merged = mergeRegistries({
      base: [rowOf({ uuid: "u1", status: "in-flight" })],
      ours: [rowOf({ uuid: "u1", status: "in-flight" })],
      theirs: [rowOf({ uuid: "u1", status: "complete" })],
    });
    expect(merged.outcome === "ok" && merged.value.rows[0]?.status).toBe(
      "complete",
    );
    expect(
      merged.outcome === "ok" && merged.value.summary.takenFromTheirs,
    ).toBe(1);
  });

  test("keeps our status transition when theirs is unchanged from base", () => {
    const merged = mergeRegistries({
      base: [rowOf({ uuid: "u1", status: "in-flight" })],
      ours: [rowOf({ uuid: "u1", status: "complete" })],
      theirs: [rowOf({ uuid: "u1", status: "in-flight" })],
    });
    expect(merged.outcome === "ok" && merged.value.rows[0]?.status).toBe(
      "complete",
    );
    expect(
      merged.outcome === "ok" && merged.value.summary.takenFromTheirs,
    ).toBe(0);
  });

  test("refuses when both sides moved one row to different states", () => {
    const merged = mergeRegistries({
      base: [rowOf({ uuid: "u1", status: "in-flight" })],
      ours: [rowOf({ uuid: "u1", status: "complete" })],
      theirs: [rowOf({ uuid: "u1", status: "migrated" })],
    });
    expect(merged.outcome === "failed" && merged.error.reason).toBe(
      "divergent-row",
    );
    expect(merged.outcome === "failed" && merged.error).toMatchObject({
      uuid: "u1",
    });
  });

  test("accepts identical concurrent edits to the same row", () => {
    const merged = mergeRegistries({
      base: [rowOf({ uuid: "u1", status: "in-flight" })],
      ours: [rowOf({ uuid: "u1", status: "complete" })],
      theirs: [rowOf({ uuid: "u1", status: "complete" })],
    });
    expect(merged.outcome === "ok" && merged.value.rows[0]?.status).toBe(
      "complete",
    );
  });

  test("treats a row absent from base as an addition, not a divergence", () => {
    const merged = mergeRegistries({
      base: [],
      ours: [rowOf({ uuid: "u1", status: "in-flight" })],
      theirs: [],
    });
    expect(merged.outcome === "ok" && merged.value.rows).toHaveLength(1);
  });

  test("refuses a row both sides added differently with no base to arbitrate", () => {
    const merged = mergeRegistries({
      base: [],
      ours: [rowOf({ uuid: "u1", status: "in-flight" })],
      theirs: [rowOf({ uuid: "u1", status: "complete" })],
    });
    expect(merged.outcome === "failed" && merged.error.reason).toBe(
      "divergent-row",
    );
  });
});

describe("renderRegistry", () => {
  test("matches the engine's two-space indent with a trailing newline", () => {
    expect(
      renderRegistry([{ uuid: "u1", slug: "a", status: "in-flight" }]),
    ).toBe(
      '[\n  {\n    "uuid": "u1",\n    "slug": "a",\n    "status": "in-flight"\n  }\n]\n',
    );
  });

  test("renders an empty registry as an empty array", () => {
    expect(renderRegistry([])).toBe("[]\n");
  });

  test("round-trips through parseRegistry unchanged", () => {
    const rows = [
      rowOf({ uuid: "u1" }),
      rowOf({ uuid: "u2", status: "complete" }),
    ];
    expect(parseRegistry(renderRegistry(rows))).toEqual({
      outcome: "ok",
      value: rows,
    });
  });

  test("reproduces an engine-written row byte for byte, field order included", () => {
    const engineWritten = [
      "[",
      "  {",
      '    "uuid": "019f1b87-ab14-7baa-aa28-b965fc468d6c",',
      '    "slug": "greeting-lib",',
      '    "dirName": "260701-greeting-lib",',
      '    "scope": "feature",',
      '    "status": "in-flight"',
      "  }",
      "]",
      "",
    ].join("\n");
    const parsed = parseRegistry(engineWritten);
    expect(parsed.outcome === "ok" && renderRegistry(parsed.value)).toBe(
      engineWritten,
    );
  });

  test("keeps repos in engine position when a row carries it", () => {
    const withRepos = [
      "[",
      "  {",
      '    "uuid": "u1",',
      '    "slug": "a",',
      '    "dirName": "260729-a",',
      '    "scope": "rin-gates",',
      '    "repos": [',
      '      "rin"',
      "    ],",
      '    "status": "in-flight"',
      "  }",
      "]",
      "",
    ].join("\n");
    const parsed = parseRegistry(withRepos);
    expect(parsed.outcome === "ok" && renderRegistry(parsed.value)).toBe(
      withRepos,
    );
  });
});

describe("describeFailure", () => {
  test("names both sides and refuses to guess on a divergent row", () => {
    const described = describeFailure({
      reason: "divergent-row",
      uuid: "u1",
      ours: '{"status":"complete"}',
      theirs: '{"status":"migrated"}',
    });
    expect(described).toContain("u1");
    expect(described).toContain("Resolve by hand");
  });

  test("reports an unreadable source with its locator", () => {
    expect(
      describeFailure({
        reason: "source-unreadable",
        locator: "/tmp/missing.json",
      }),
    ).toContain("/tmp/missing.json");
  });

  test("reports a side that already carries conflict markers", () => {
    expect(
      describeFailure({
        reason: "conflict-markers-present",
        locator: "intents.json",
      }),
    ).toContain("conflict markers");
  });
});
