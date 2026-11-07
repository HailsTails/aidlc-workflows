import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllOwnedCarveOuts } from "./rin-harness-cd-carve-outs.ts";
import { CD_ENFORCEMENT } from "./rin-harness-cd-enforcement.ts";
import {
  defaultSidecarFileReader,
  type SidecarFileReader,
} from "./rin-harness-sidecar-file-reader.ts";

type ExemptionPair = {
  readonly file: string;
  readonly rule: string;
  readonly sidecarCd: string;
  readonly decision: string;
  readonly ruleRecovery: RuleRecovery;
};

type RuleRecovery =
  | { readonly kind: "sole-active-rule-on-sensor" }
  | { readonly kind: "collapsed-onto-host"; readonly redirectedFrom: string }
  | { readonly kind: "co-enforced"; readonly candidates: readonly string[] }
  | { readonly kind: "sidecar-has-no-enforcement" }
  | { readonly kind: "sensor-has-no-atomic-rule" };

type EnforcedRules =
  | { readonly kind: "one"; readonly ruleId: string }
  | { readonly kind: "many"; readonly ruleIds: readonly string[] }
  | { readonly kind: "no-sensor" }
  | { readonly kind: "no-atomic-rule" };

type SeedKey = {
  readonly rule: string;
  readonly packageName: string;
};

type Cluster = {
  readonly seeds: readonly SeedKey[];
  readonly pairs: readonly ExemptionPair[];
  readonly files: readonly string[];
};

type CollapseRedirect = {
  readonly from: string;
  readonly onto: string;
};

type InventoryReport = {
  readonly pairs: readonly ExemptionPair[];
  readonly mergedDuplicatePairCount: number;
  readonly unrecoverablePairs: readonly ExemptionPair[];
  readonly clusters: readonly Cluster[];
  readonly largestClusterFileCount: number;
  readonly coEnforcedSensors: readonly CoEnforcedSensor[];
  readonly collapseTargets: readonly CollapseRedirect[];
};

type CoEnforcedSensor = {
  readonly sidecarCd: string;
  readonly rules: readonly string[];
};

const CD_CORPUS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "knowledge",
  "aidlc-shared",
  "code-discipline",
);
const COLLAPSED_INTO = /^collapsed-into:\s*(CD-[\w-]+)\s*$/im;
const RULE_ID = /^id:\s*(CD-[\w-]+)\s*$/im;

const atomicRuleIdsOf = (args: {
  readonly rulePrefixes: readonly string[];
}): readonly string[] =>
  args.rulePrefixes.filter((prefix) => !prefix.includes("/"));

const collapseTargetsOf = (args: {
  readonly corpusDir: string;
  readonly reader: SidecarFileReader;
}): ReadonlyMap<string, string> => {
  const corpusDir = args.corpusDir;
  return (args.reader.listDirectory(corpusDir) ?? [])
    .filter((name) => /^cd-\d+[a-z]?-.*\.md$/.test(name))
    .reduce<ReadonlyMap<string, string>>((accumulated, name) => {
      const raw = args.reader.readFile(join(corpusDir, name));
      if (raw === undefined) return accumulated;
      const collapsed = COLLAPSED_INTO.exec(raw);
      const ruleId = RULE_ID.exec(raw);
      if (collapsed === null || ruleId === null) return accumulated;
      const from = ruleId[1];
      const onto = collapsed[1];
      if (from === undefined || onto === undefined) return accumulated;
      return new Map(accumulated).set(from.toUpperCase(), onto.toUpperCase());
    }, new Map());
};

const enforcedRuleIdsOf = (args: {
  readonly sidecarCd: string;
  readonly collapseTargets: ReadonlyMap<string, string>;
}): EnforcedRules => {
  const enforcement = CD_ENFORCEMENT.find(
    (candidate) =>
      candidate.cdId.toUpperCase() === args.sidecarCd.toUpperCase(),
  );
  if (enforcement === undefined) return { kind: "no-sensor" };
  const resolved = [
    ...new Set(
      atomicRuleIdsOf({ rulePrefixes: enforcement.rulePrefixes }).map(
        (ruleId) =>
          args.collapseTargets.get(ruleId.toUpperCase()) ??
          ruleId.toUpperCase(),
      ),
    ),
  ];
  const sole = resolved[0];
  if (sole === undefined) return { kind: "no-atomic-rule" };
  if (resolved.length > 1) return { kind: "many", ruleIds: resolved };
  return { kind: "one", ruleId: sole };
};

const coEnforcedSensorsOf = (args: {
  readonly collapseTargets: ReadonlyMap<string, string>;
}): readonly CoEnforcedSensor[] =>
  CD_ENFORCEMENT.flatMap((enforcement) => {
    const enforced = enforcedRuleIdsOf({
      sidecarCd: enforcement.cdId,
      collapseTargets: args.collapseTargets,
    });
    if (enforced.kind !== "many") return [];
    return [{ sidecarCd: enforcement.cdId, rules: enforced.ruleIds }];
  });

const recoveredRule = (args: {
  readonly sidecarCd: string;
  readonly collapseTargets: ReadonlyMap<string, string>;
}): { readonly rule: string; readonly recovery: RuleRecovery } => {
  const enforced = enforcedRuleIdsOf({
    sidecarCd: args.sidecarCd,
    collapseTargets: args.collapseTargets,
  });
  const sidecarCd = args.sidecarCd.toUpperCase();
  if (enforced.kind === "no-sensor") {
    return {
      rule: sidecarCd,
      recovery: { kind: "sidecar-has-no-enforcement" },
    };
  }
  if (enforced.kind === "no-atomic-rule") {
    return { rule: sidecarCd, recovery: { kind: "sensor-has-no-atomic-rule" } };
  }
  if (enforced.kind === "many") {
    return {
      rule: sidecarCd,
      recovery: { kind: "co-enforced", candidates: enforced.ruleIds },
    };
  }
  if (enforced.ruleId !== sidecarCd) {
    return {
      rule: enforced.ruleId,
      recovery: { kind: "collapsed-onto-host", redirectedFrom: sidecarCd },
    };
  }
  return {
    rule: enforced.ruleId,
    recovery: { kind: "sole-active-rule-on-sensor" },
  };
};

const packageOf = ({ file }: { readonly file: string }): string => {
  const normalized = file.replace(/\\/g, "/");
  const segments = normalized.split("/");
  const srcIndex = segments.indexOf("src");
  if (srcIndex > 0) return segments.slice(0, srcIndex).join("/");
  return dirname(normalized);
};

const exemptionPairsOf = (args: {
  readonly projectDir: string;
  readonly reader: SidecarFileReader;
  readonly collapseTargets: ReadonlyMap<string, string>;
}): readonly ExemptionPair[] =>
  loadAllOwnedCarveOuts({
    projectDir: args.projectDir,
    reader: args.reader,
  }).flatMap((owned) => {
    const { rule, recovery } = recoveredRule({
      sidecarCd: owned.cd,
      collapseTargets: args.collapseTargets,
    });
    return owned.files.map((file) => ({
      file: file.replace(/\\/g, "/"),
      rule,
      sidecarCd: owned.cd,
      decision: owned.decision,
      ruleRecovery: recovery,
    }));
  });

const pairKeyOf = ({ pair }: { readonly pair: ExemptionPair }): string =>
  `${pair.file}::${pair.rule}`;

const seedKeyOf = ({ pair }: { readonly pair: ExemptionPair }): string =>
  `${pair.rule}::${packageOf({ file: pair.file })}`;

const distinctPairsOf = (args: {
  readonly pairs: readonly ExemptionPair[];
}): readonly ExemptionPair[] =>
  args.pairs.filter(
    (pair, index) =>
      args.pairs.findIndex(
        (candidate) => pairKeyOf({ pair: candidate }) === pairKeyOf({ pair }),
      ) === index,
  );

const seedGroupsOf = (args: {
  readonly pairs: readonly ExemptionPair[];
}): ReadonlyMap<string, readonly ExemptionPair[]> =>
  args.pairs.reduce<ReadonlyMap<string, readonly ExemptionPair[]>>(
    (accumulated, pair) => {
      const key = seedKeyOf({ pair });
      return new Map(accumulated).set(key, [
        ...(accumulated.get(key) ?? []),
        pair,
      ]);
    },
    new Map(),
  );

const pairsByFileOf = (args: {
  readonly pairs: readonly ExemptionPair[];
}): ReadonlyMap<string, readonly ExemptionPair[]> =>
  args.pairs.reduce<ReadonlyMap<string, readonly ExemptionPair[]>>(
    (accumulated, pair) =>
      new Map(accumulated).set(pair.file, [
        ...(accumulated.get(pair.file) ?? []),
        pair,
      ]),
    new Map(),
  );

const seedKeyParsed = ({ key }: { readonly key: string }): SeedKey => {
  const [rule, packageName] = key.split("::");
  return { rule: rule ?? "", packageName: packageName ?? "" };
};

const clustersOf = (args: {
  readonly pairs: readonly ExemptionPair[];
}): readonly Cluster[] => {
  const seedGroups = seedGroupsOf({ pairs: args.pairs });
  const pairsByFile = pairsByFileOf({ pairs: args.pairs });
  return [...seedGroups.entries()].map(([seedKey, seedPairs]) => {
    const seedFiles = [...new Set(seedPairs.map((pair) => pair.file))];
    const closedPairs = seedFiles.flatMap(
      (file) => pairsByFile.get(file) ?? [],
    );
    return {
      seeds: [seedKeyParsed({ key: seedKey })],
      pairs: closedPairs,
      files: seedFiles.sort(),
    };
  });
};

const inventoryOf = (args: {
  readonly projectDir: string;
  readonly reader?: SidecarFileReader;
}): InventoryReport => {
  const reader = args.reader ?? defaultSidecarFileReader();
  const collapseTargets = collapseTargetsOf({
    corpusDir: CD_CORPUS_DIR,
    reader,
  });
  const rawPairs = exemptionPairsOf({
    projectDir: args.projectDir,
    reader,
    collapseTargets,
  });
  const pairs = distinctPairsOf({ pairs: rawPairs });
  const clusters = clustersOf({ pairs });
  return {
    pairs,
    mergedDuplicatePairCount: rawPairs.length - pairs.length,
    unrecoverablePairs: pairs.filter(
      (pair) =>
        pair.ruleRecovery.kind === "co-enforced" ||
        pair.ruleRecovery.kind === "sidecar-has-no-enforcement",
    ),
    clusters,
    largestClusterFileCount: clusters.reduce(
      (largest, cluster) => Math.max(largest, cluster.files.length),
      0,
    ),
    coEnforcedSensors: coEnforcedSensorsOf({ collapseTargets }),
    collapseTargets: [...collapseTargets.entries()].map(([from, onto]) => ({
      from,
      onto,
    })),
  };
};

const renderReport = ({
  report,
}: {
  readonly report: InventoryReport;
}): string =>
  JSON.stringify(
    {
      pairCount: report.pairs.length,
      fileCount: new Set(report.pairs.map((pair) => pair.file)).size,
      ruleCount: new Set(report.pairs.map((pair) => pair.rule)).size,
      coEnforcedSensors: report.coEnforcedSensors,
      mergedDuplicatePairCount: report.mergedDuplicatePairCount,
      unrecoverablePairCount: report.unrecoverablePairs.length,
      unrecoverablePairs: report.unrecoverablePairs,
      clusterCount: report.clusters.length,
      largestClusterFileCount: report.largestClusterFileCount,
      clusterSizes: report.clusters
        .map((cluster) => cluster.files.length)
        .sort((left, right) => right - left),
      clusters: report.clusters.map((cluster) => ({
        seeds: cluster.seeds,
        fileCount: cluster.files.length,
        pairCount: cluster.pairs.length,
        files: cluster.files,
      })),
    },
    undefined,
    2,
  );

const seedFileCountsOf = (args: {
  readonly pairs: readonly ExemptionPair[];
}): ReadonlyMap<string, number> =>
  [...seedGroupsOf({ pairs: args.pairs }).entries()].reduce<
    ReadonlyMap<string, number>
  >(
    (accumulated, [seedKey, seedPairs]) =>
      new Map(accumulated).set(
        seedKey,
        new Set(seedPairs.map((pair) => pair.file)).size,
      ),
    new Map(),
  );

const largestSeedOf = (args: {
  readonly seedFileCounts: ReadonlyMap<string, number>;
}): { readonly seedKey: string; readonly fileCount: number } => {
  const ranked = [...args.seedFileCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];
  if (ranked === undefined) return { seedKey: "none", fileCount: 0 };
  return { seedKey: ranked[0], fileCount: ranked[1] };
};

const headerLinesOf = (args: {
  readonly report: InventoryReport;
}): readonly string[] => [
  `pairs=${args.report.pairs.length} files=${new Set(args.report.pairs.map((pair) => pair.file)).size} rules=${new Set(args.report.pairs.map((pair) => pair.rule)).size}`,
  `clusters=${args.report.clusters.length} largest=${args.report.largestClusterFileCount} files`,
  `unrecoverable=${args.report.unrecoverablePairs.length} mergedDuplicates=${args.report.mergedDuplicatePairCount}`,
  `collapsed rule ids: ${args.report.collapseTargets.map((redirect) => `${redirect.from}->${redirect.onto}`).join(" ")}`,
  `co-enforced sensors: ${args.report.coEnforcedSensors.map((sensor) => `${sensor.sidecarCd}[${sensor.rules.join("+")}]`).join(" ") || "none"}`,
];

const clusterLinesOf = (args: {
  readonly clusters: readonly Cluster[];
}): readonly string[] =>
  [...args.clusters]
    .sort((left, right) => right.files.length - left.files.length)
    .map(
      (cluster, index) =>
        `#${index + 1} files=${cluster.files.length} pairs=${cluster.pairs.length} seeds=${cluster.seeds
          .map((seed) => `(${seed.rule},${seed.packageName})`)
          .join(" ")}`,
    );

const renderSummary = ({
  report,
}: {
  readonly report: InventoryReport;
}): string => {
  const seedFileCounts = seedFileCountsOf({ pairs: report.pairs });
  const largestSeed = largestSeedOf({ seedFileCounts });
  return [
    ...headerLinesOf({ report }),
    "",
    `seeds=${seedFileCounts.size} largestSeed=${largestSeed.fileCount} files at ${largestSeed.seedKey}`,
    "",
    ...clusterLinesOf({ clusters: report.clusters }),
  ].join("\n");
};

const main = (): void => {
  const report = inventoryOf({ projectDir: process.cwd() });
  const wantsSummary = process.argv.includes("--summary");
  process.stdout.write(
    `${wantsSummary ? renderSummary({ report }) : renderReport({ report })}\n`,
  );
  process.exit(report.unrecoverablePairs.length === 0 ? 0 : 1);
};

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}

export type {
  Cluster,
  CollapseRedirect,
  ExemptionPair,
  InventoryReport,
  RuleRecovery,
  SeedKey,
};
export {
  clustersOf,
  coEnforcedSensorsOf,
  collapseTargetsOf,
  enforcedRuleIdsOf,
  inventoryOf,
  largestSeedOf,
  packageOf,
  recoveredRule,
  seedFileCountsOf,
};
