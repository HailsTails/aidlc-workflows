import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  BASELINE_RESTORE_REMEDY,
  type BaselineLoad,
  baselineIsMeasurable,
  baselinePath,
  chainBaselineFor,
  whyChainProblemForEntry as checkEntry,
  DIGEST_LENGTH,
  entryDigest as digestAtOrigin,
  loadBaseline,
  NOT_OPTED_IN,
} from "./rin-harness-exception-baseline.ts";
import type { SidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const COMPLETE_CHAIN = {
  whys: [1, 2, 3, 4, 5].map((step) => ({
    why: `why ${step}`,
    because: `because the matcher at step ${step} could not express the id`,
    evidence: `plugins/rin/tools/example.ts:${step}`,
  })),
  rootCause:
    "the walker's tracker matcher is the retired Spec-Kit pattern, so no issuable id satisfies it",
  owner: "capture 01a0b421-a842-77d5-84dc-282775bac424",
};

const LEGACY_ENTRY = {
  files: ["packages/kernel/src/legacy.ts"],
  reason: "Migrated from rin @rin/kernel CD-19 carve-out.",
  decision: "rin:audit-scope-paydown",
};

const LEGACY_ORIGIN = {
  registry: ".constitution-carve-outs",
  sidecar: "cd-19.json",
};

const entryDigest = ({ entry }: { readonly entry: unknown }): string =>
  digestAtOrigin({ entry, origin: LEGACY_ORIGIN });

const whyChainProblemForEntry = ({
  entry,
  baseline,
}: {
  readonly entry: unknown;
  readonly baseline: BaselineLoad;
}): string | undefined =>
  checkEntry({ entry, baseline, origin: LEGACY_ORIGIN });

const baselineHolding = ({
  entries,
}: {
  readonly entries: readonly unknown[];
}): BaselineLoad => ({
  kind: "loaded",
  digests: new Set(entries.map((entry) => entryDigest({ entry }))),
});

const EMPTY_BASELINE: BaselineLoad = { kind: "loaded", digests: new Set() };

describe("a legacy entry is exempt from the refusal", () => {
  test("an entry in the baseline needs no chain", () => {
    expect(
      whyChainProblemForEntry({
        entry: LEGACY_ENTRY,
        baseline: baselineHolding({ entries: [LEGACY_ENTRY] }),
      }),
    ).toBeUndefined();
  });

  test("modifying a legacy entry drops it from the baseline and obliges a chain", () => {
    expect(
      whyChainProblemForEntry({
        entry: { ...LEGACY_ENTRY, reason: "Migrated, and since widened." },
        baseline: baselineHolding({ entries: [LEGACY_ENTRY] }),
      }),
    ).toContain("whyChain");
  });

  test("moving a legacy entry to another sidecar obliges a chain", () => {
    expect(
      checkEntry({
        entry: LEGACY_ENTRY,
        baseline: baselineHolding({ entries: [LEGACY_ENTRY] }),
        origin: { ...LEGACY_ORIGIN, sidecar: "cd-20.json" },
      }),
    ).toContain("whyChain");
  });
});

describe("a project that has not opted in is not asked for chains", () => {
  test("a chainless entry passes when the project has not opted in", () => {
    expect(
      checkEntry({
        entry: LEGACY_ENTRY,
        baseline: NOT_OPTED_IN,
        origin: LEGACY_ORIGIN,
      }),
    ).toBeUndefined();
  });
});

describe("a new entry must carry a complete chain", () => {
  test("a new entry with no chain is refused", () => {
    expect(
      whyChainProblemForEntry({
        entry: LEGACY_ENTRY,
        baseline: EMPTY_BASELINE,
      }),
    ).toContain("required");
  });

  test("a new entry with a complete chain is accepted", () => {
    expect(
      whyChainProblemForEntry({
        entry: { ...LEGACY_ENTRY, whyChain: COMPLETE_CHAIN },
        baseline: EMPTY_BASELINE,
      }),
    ).toBeUndefined();
  });

  test("a new entry with an incomplete chain is refused", () => {
    expect(
      whyChainProblemForEntry({
        entry: {
          ...LEGACY_ENTRY,
          whyChain: {
            ...COMPLETE_CHAIN,
            whys: COMPLETE_CHAIN.whys.slice(0, 3),
          },
        },
        baseline: EMPTY_BASELINE,
      }),
    ).toContain("incomplete");
  });

  test("a new entry whose chain bottoms out at a symptom is refused", () => {
    expect(
      whyChainProblemForEntry({
        entry: {
          ...LEGACY_ENTRY,
          whyChain: { ...COMPLETE_CHAIN, rootCause: "the gate was failing" },
        },
        baseline: EMPTY_BASELINE,
      }),
    ).toContain("incomplete");
  });
});

describe("a baseline speaking a different digest width is unusable", () => {
  const baselineOf = ({
    digests,
  }: {
    readonly digests: readonly string[];
  }): BaselineLoad => ({ kind: "loaded", digests: new Set(digests) });

  test("digests of the current width are usable", () => {
    expect(
      baselineIsMeasurable({
        baseline: baselineOf({ digests: ["0123456789abcdef"] }),
      }),
    ).toBe(true);
  });

  test.each([
    ["longer", "0123456789abcdef0123"],
    ["shorter", "0123456789ab"],
  ])("%s digests are not usable", (_label, digest) => {
    expect(
      baselineIsMeasurable({
        baseline: baselineOf({ digests: [digest] }),
      }),
    ).toBe(false);
  });

  test("one stale digest among current ones is enough to refuse", () => {
    expect(
      baselineIsMeasurable({
        baseline: baselineOf({
          digests: ["0123456789abcdef", "0123456789abcdef0123"],
        }),
      }),
    ).toBe(false);
  });

  test.each([
    ["absent"],
    ["unreadable-io"],
    ["unparseable"],
    ["truncated"],
  ] as const)("an %s baseline is not measurable", (reason) => {
    expect(
      baselineIsMeasurable({ baseline: { kind: "unreadable", reason } }),
    ).toBe(false);
  });

  test("the current width is what the digest function produces", () => {
    expect(entryDigest({ entry: { any: "entry" } })).toHaveLength(
      DIGEST_LENGTH,
    );
  });

  test("a known entry hashes to its known digest", () => {
    expect(
      entryDigest({ entry: { files: ["a.ts"], reason: "r", decision: "d" } }),
    ).toBe("fc270fbd46b80d77");
  });
});

describe("the baseline's location is project-owned", () => {
  test("it resolves to the project root", () => {
    expect(baselinePath("/repo")).toBe(
      join("/repo", ".r7-legacy-baseline.json"),
    );
  });

  test("it is not inside either registry directory", () => {
    const path = baselinePath("/repo");
    expect(
      path.includes(".constitution-carve-outs") ||
        path.includes(".constitution-authorised-locations"),
    ).toBe(false);
  });
});

describe("the opt-in decides which baseline the registry doors judge against", () => {
  const PRESENT_BASELINE: SidecarFileReader = {
    fileExists: (path) => path === baselinePath("/repo"),
    readFile: () => '{"entryCount":1,"digests":["0123456789abcdef"]}',
    listDirectory: () => [],
  };

  test("an enabled project is judged against its baseline file", () => {
    expect(
      chainBaselineFor({
        optIn: { kind: "enabled" },
        projectDir: "/repo",
        reader: PRESENT_BASELINE,
      }),
    ).toEqual({ kind: "loaded", digests: new Set(["0123456789abcdef"]) });
  });

  test("a disabled project is not asked for chains, whatever its files hold", () => {
    expect(
      chainBaselineFor({
        optIn: { kind: "disabled" },
        projectDir: "/repo",
        reader: PRESENT_BASELINE,
      }),
    ).toEqual(NOT_OPTED_IN);
  });
});

describe("a baseline whose declared size disagrees with its rows is unusable", () => {
  const readerWith = (body: string): SidecarFileReader => ({
    fileExists: (path) => path === baselinePath("/repo"),
    readFile: () => body,
    listDirectory: () => [],
  });

  test("a matching entryCount loads", () => {
    expect(
      loadBaseline({
        projectDir: "/repo",
        reader: readerWith('{"entryCount":2,"digests":["0123456789abcdef","fedcba9876543210"]}'),
      }).kind,
    ).toBe("loaded");
  });

  test("a truncated file reports that it could not run", () => {
    expect(
      loadBaseline({
        projectDir: "/repo",
        reader: readerWith('{"entryCount":66,"digests":["aaaa","bbbb"]}'),
      }).kind,
    ).toBe("unreadable");
  });

  test("a baseline with no declared count reports that it could not run", () => {
    expect(
      loadBaseline({
        projectDir: "/repo",
        reader: readerWith('{"digests":["aaaa","bbbb"]}'),
      }),
    ).toEqual({ kind: "unreadable", reason: "unparseable" });
  });

  test("a non-string digest makes the file unparseable rather than being filtered out", () => {
    expect(
      loadBaseline({
        projectDir: "/repo",
        reader: readerWith('{"entryCount":2,"digests":["aaaa",7]}'),
      }),
    ).toEqual({ kind: "unreadable", reason: "unparseable" });
  });

  test("a file that exists but cannot be read is an io failure, not an absence", () => {
    expect(
      loadBaseline({
        projectDir: "/repo",
        reader: {
          fileExists: () => true,
          readFile: () => undefined,
          listDirectory: () => [],
        },
      }),
    ).toEqual({ kind: "unreadable", reason: "unreadable-io" });
  });

  test("a non-numeric declared count reports that it could not run", () => {
    expect(
      loadBaseline({
        projectDir: "/repo",
        reader: readerWith('{"entryCount":"2","digests":["aaaa","bbbb"]}'),
      }),
    ).toEqual({ kind: "unreadable", reason: "unparseable" });
  });
});

describe("an absent baseline reports that it could not run", () => {
  const ABSENT: BaselineLoad = { kind: "unreadable", reason: "absent" };

  test("an entry that would otherwise be legacy is not silently exempted", () => {
    expect(
      whyChainProblemForEntry({ entry: LEGACY_ENTRY, baseline: ABSENT }),
    ).toContain("cannot be established");
  });

  test("the report names the restoring command rather than only the problem", () => {
    expect(
      whyChainProblemForEntry({ entry: LEGACY_ENTRY, baseline: ABSENT }),
    ).toContain(BASELINE_RESTORE_REMEDY);
  });

  test("the report never points at the generator, which refuses an absent baseline", () => {
    expect(
      whyChainProblemForEntry({ entry: LEGACY_ENTRY, baseline: ABSENT }),
    ).not.toContain("generate-exception-baseline");
  });

  test("even a complete chain does not mask the absent baseline", () => {
    expect(
      whyChainProblemForEntry({
        entry: { ...LEGACY_ENTRY, whyChain: COMPLETE_CHAIN },
        baseline: ABSENT,
      }),
    ).toContain("cannot be established");
  });
});

describe("baseline loading validates every digest before granting legacy status", () => {
  test("a matching digest beside a wrong-width digest cannot grant an exemption", () => {
    const baseline = loadBaseline({
      projectDir: "/repo",
      reader: {
        fileExists: () => true,
        readFile: () => JSON.stringify({
          entryCount: 2,
          digests: [entryDigest({ entry: LEGACY_ENTRY }), "bad"],
        }),
        listDirectory: () => [],
      },
    });
    expect(baseline).toEqual({ kind: "unreadable", reason: "width" });
    expect(whyChainProblemForEntry({ entry: LEGACY_ENTRY, baseline })).toContain("width");
    expect(whyChainProblemForEntry({ entry: LEGACY_ENTRY, baseline })).toContain("absence is not an exemption");
  });
});
