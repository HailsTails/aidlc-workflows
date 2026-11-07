import { describe, expect, test } from "vitest";
import {
  clustersOf,
  coEnforcedSensorsOf,
  collapseTargetsOf,
  type ExemptionPair,
  enforcedRuleIdsOf,
  largestSeedOf,
  packageOf,
  recoveredRule,
  seedFileCountsOf,
} from "./rin-harness-audit-debt-inventory.ts";
import type { SidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const pairAt = ({
  file,
  rule,
}: {
  readonly file: string;
  readonly rule: string;
}): ExemptionPair => ({
  file,
  rule,
  sidecarCd: rule,
  decision: "rin:test",
  ruleRecovery: { kind: "sole-active-rule-on-sensor" },
});

const readerOver = ({
  files,
}: {
  readonly files: Readonly<Record<string, string>>;
}): SidecarFileReader => ({
  fileExists: (path) => Object.hasOwn(files, path.replace(/\\/g, "/")),
  readFile: (path) => files[path.replace(/\\/g, "/")],
  listDirectory: () =>
    Object.keys(files).map((path) => path.split("/").pop() ?? ""),
});

const COLLAPSE_TARGETS = new Map([
  ["CD-20", "CD-19"],
  ["CD-24", "CD-23"],
  ["CD-16", "CD-15"],
]);

describe("collapseTargetsOf", () => {
  test("reads a collapsed rule's redirect target from its frontmatter", () => {
    const reader = readerOver({
      files: {
        "rules/cd-020-stdlib.md":
          "---\nid: CD-20\nstatus: collapsed-into\ncollapsed-into: CD-19\n---\n",
      },
    });
    expect([
      ...collapseTargetsOf({ corpusDir: "rules", reader }).entries(),
    ]).toEqual([["CD-20", "CD-19"]]);
  });

  test("omits an active rule that declares no redirect", () => {
    const reader = readerOver({
      files: {
        "rules/cd-002-casts.md":
          "---\nid: CD-2\nstatus: active\n---\n",
      },
    });
    expect(collapseTargetsOf({ corpusDir: "rules", reader }).size).toBe(0);
  });
});

describe("enforcedRuleIdsOf", () => {
  test("resolves a collapsed prefix to its host rule", () => {
    expect(
      enforcedRuleIdsOf({
        sidecarCd: "CD-19",
        collapseTargets: COLLAPSE_TARGETS,
      }),
    ).toEqual({ kind: "one", ruleId: "CD-19" });
  });

  test("keeps two co-enforced active rules distinct", () => {
    expect(
      enforcedRuleIdsOf({
        sidecarCd: "CD-1",
        collapseTargets: COLLAPSE_TARGETS,
      }),
    ).toEqual({ kind: "many", ruleIds: ["CD-1", "CD-2"] });
  });

  test("reports no-sensor for a sidecar no sensor enforces", () => {
    expect(
      enforcedRuleIdsOf({
        sidecarCd: "CD-999",
        collapseTargets: COLLAPSE_TARGETS,
      }),
    ).toEqual({ kind: "no-sensor" });
  });

  test("drops a compound prefix rather than treating it as a rule id", () => {
    expect(
      enforcedRuleIdsOf({
        sidecarCd: "CD-23",
        collapseTargets: COLLAPSE_TARGETS,
      }),
    ).toEqual({ kind: "one", ruleId: "CD-23" });
  });
});

describe("recoveredRule", () => {
  test("returns the sole active rule for an unfolded sensor", () => {
    expect(
      recoveredRule({ sidecarCd: "CD-6", collapseTargets: COLLAPSE_TARGETS }),
    ).toEqual({
      rule: "CD-6",
      recovery: { kind: "sole-active-rule-on-sensor" },
    });
  });

  test("resolves a sidecar whose second prefix is a collapsed redirect to one rule", () => {
    expect(
      recoveredRule({ sidecarCd: "CD-19", collapseTargets: COLLAPSE_TARGETS }),
    ).toEqual({
      rule: "CD-19",
      recovery: { kind: "sole-active-rule-on-sensor" },
    });
  });

  test("reports co-enforced when a sensor enforces two active rules", () => {
    expect(
      recoveredRule({ sidecarCd: "CD-1", collapseTargets: COLLAPSE_TARGETS })
        .recovery.kind,
    ).toBe("co-enforced");
  });

  test("reports no-enforcement for a sidecar absent from the enforcement table", () => {
    expect(
      recoveredRule({ sidecarCd: "CD-999", collapseTargets: COLLAPSE_TARGETS })
        .recovery.kind,
    ).toBe("sidecar-has-no-enforcement");
  });
});

describe("coEnforcedSensorsOf", () => {
  test("reports only sensors enforcing more than one active rule", () => {
    expect(
      coEnforcedSensorsOf({ collapseTargets: COLLAPSE_TARGETS }).map(
        (sensor) => sensor.sidecarCd,
      ),
    ).toEqual(["CD-1"]);
  });
});

describe("packageOf", () => {
  test("returns the path above src for a package file", () => {
    expect(packageOf({ file: "packages/kernel/src/auth/jwt.ts" })).toBe(
      "packages/kernel",
    );
  });

  test("normalises backslash separators", () => {
    expect(packageOf({ file: "apps\\gateway\\src\\index.ts" })).toBe(
      "apps/gateway",
    );
  });

  test("falls back to the containing directory when no src segment exists", () => {
    expect(packageOf({ file: "plugins/rin/tools/thing.ts" })).toBe(
      "plugins/rin/tools",
    );
  });
});

describe("clustersOf", () => {
  test("keeps two seeds separate when no file bridges them", () => {
    expect(
      clustersOf({
        pairs: [
          pairAt({ file: "packages/kernel/src/a.ts", rule: "CD-6" }),
          pairAt({ file: "packages/ui/src/b.ts", rule: "CD-23" }),
        ],
      }),
    ).toHaveLength(2);
  });

  test("keeps a cluster's file count equal to its seed's file count", () => {
    const clusters = clustersOf({
      pairs: [
        pairAt({ file: "packages/kernel/src/a.ts", rule: "CD-6" }),
        pairAt({ file: "packages/kernel/src/a.ts", rule: "CD-19" }),
        pairAt({ file: "packages/kernel/src/b.ts", rule: "CD-19" }),
      ],
    });
    const cdSix = clusters.find((cluster) => cluster.seeds[0]?.rule === "CD-6");
    expect(cdSix?.files).toEqual(["packages/kernel/src/a.ts"]);
  });

  test("adds the bridging file's other pairs without adding that seed's other files", () => {
    const clusters = clustersOf({
      pairs: [
        pairAt({ file: "packages/kernel/src/a.ts", rule: "CD-6" }),
        pairAt({ file: "packages/kernel/src/a.ts", rule: "CD-19" }),
        pairAt({ file: "packages/kernel/src/b.ts", rule: "CD-19" }),
      ],
    });
    const cdSix = clusters.find((cluster) => cluster.seeds[0]?.rule === "CD-6");
    expect(cdSix?.pairs.map((pair) => pair.rule).sort()).toEqual([
      "CD-19",
      "CD-6",
    ]);
  });

  test("does not chain a third seed through two separate bridge files", () => {
    const clusters = clustersOf({
      pairs: [
        pairAt({ file: "packages/kernel/src/bridge-one.ts", rule: "CD-6" }),
        pairAt({ file: "packages/kernel/src/bridge-one.ts", rule: "CD-19" }),
        pairAt({ file: "packages/kernel/src/bridge-two.ts", rule: "CD-19" }),
        pairAt({ file: "packages/kernel/src/bridge-two.ts", rule: "CD-27" }),
        pairAt({ file: "packages/kernel/src/tail.ts", rule: "CD-27" }),
      ],
    });
    const cdSix = clusters.find((cluster) => cluster.seeds[0]?.rule === "CD-6");
    expect(cdSix?.files).toEqual(["packages/kernel/src/bridge-one.ts"]);
  });

  test("separates same-rule seeds that sit in different packages", () => {
    expect(
      clustersOf({
        pairs: [
          pairAt({ file: "packages/kernel/src/a.ts", rule: "CD-6" }),
          pairAt({ file: "apps/gateway/src/b.ts", rule: "CD-6" }),
        ],
      }),
    ).toHaveLength(2);
  });
});

describe("seedFileCountsOf", () => {
  test("counts distinct files per seed", () => {
    expect([
      ...seedFileCountsOf({
        pairs: [
          pairAt({ file: "packages/kernel/src/a.ts", rule: "CD-6" }),
          pairAt({ file: "packages/kernel/src/b.ts", rule: "CD-6" }),
        ],
      }).entries(),
    ]).toEqual([["CD-6::packages/kernel", 2]]);
  });
});

describe("largestSeedOf", () => {
  test("returns the seed holding the most files", () => {
    expect(
      largestSeedOf({
        seedFileCounts: new Map([
          ["CD-6::packages/kernel", 2],
          ["CD-23::packages/ui", 24],
        ]),
      }),
    ).toEqual({ seedKey: "CD-23::packages/ui", fileCount: 24 });
  });

  test("reports no seed when the corpus is empty", () => {
    expect(largestSeedOf({ seedFileCounts: new Map() })).toEqual({
      seedKey: "none",
      fileCount: 0,
    });
  });
});
