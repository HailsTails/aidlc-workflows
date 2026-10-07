import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IMPORTANCE_BINDING_FILENAME } from "./rin-gates-importance-binding.ts";
import {
  type Clock,
  createNodeRecordStore,
  createSystemClock,
  type FileSystemCapabilities,
  nodeFileSystemCapabilities,
  type RecordStore,
} from "./rin-gates-record-store.ts";
import {
  parseSelectionConfig,
  selectionRankingConfigPath,
} from "./rin-gates-selection-config.ts";
import {
  gatherMigrationRecords,
  type MigrationGatherFailure,
  renderMigrationSummary,
  runTierMigration,
} from "./rin-gates-tier-migration.ts";

const DERIVATION_FILENAME = "importance-derivation.md";
const CHECKOUT_MARKER = ".git";
const INTENTS_SEGMENTS = ["aidlc", "spaces", "default", "intents"] as const;

type RatifiedMilestonesResolution =
  | {
      readonly kind: "resolved";
      readonly ratifiedMilestones: readonly string[];
    }
  | { readonly kind: "config-unreadable"; readonly path: string }
  | {
      readonly kind: "config-malformed";
      readonly path: string;
      readonly detail: string;
    };

// Fails loud rather than defaulting to an empty roster: an empty roster makes
// every milestone read unratified, so the FR-4 exclusion would pass vacuously
// over every ratified-milestone record in the corpus — exactly the silent
// miss this migration exists to close. Mirrors the same read in
// rin-gates-promote.ts's readRatifiedMilestones, adapted to this file's
// Result-returning style rather than its process.exit-on-failure one.
const resolveRatifiedMilestones = (args: {
  readonly toolsDir: string;
  readonly fileSystem: FileSystemCapabilities;
}): RatifiedMilestonesResolution => {
  const path = selectionRankingConfigPath({ toolsDir: args.toolsDir });
  const raw = ((): string | null => {
    try {
      return args.fileSystem.readFile({ path });
    } catch {
      return null;
    }
  })();
  if (raw === null) return { kind: "config-unreadable", path };
  const parsed = parseSelectionConfig({ raw });
  return parsed.outcome === "failed"
    ? { kind: "config-malformed", path, detail: parsed.error.detail }
    : { kind: "resolved", ratifiedMilestones: parsed.value.ratifiedMilestones };
};

const renderGatherFailure = (failure: MigrationGatherFailure): string =>
  failure.kind === "malformed-binding"
    ? `rin-gates-tier-migration: importance-binding.json at ${failure.recordDir} is present but fails IF-1's schema — fix or remove it before re-running`
    : `rin-gates-tier-migration: ${failure.kind} at ${failure.path}: ${failure.detail}`;

type Output = {
  readonly writeOut: (args: { readonly line: string }) => void;
  readonly writeError: (args: { readonly line: string }) => void;
};

type IntentsRootResolution =
  | { readonly kind: "resolved"; readonly intentsRoot: string }
  | { readonly kind: "no-checkout-root"; readonly from: string }
  | { readonly kind: "intents-root-absent"; readonly expected: string };

// The checkout root is found by walking up to the marker, never by counting a
// fixed number of parent segments: this file is copied verbatim to a different
// depth by the harness compose step, so any hard-coded ancestor count is right
// at one depth and silently wrong at the other. An absent intents root is a
// distinct, LOUD outcome — the store maps a missing directory to an empty
// listing, which would otherwise render as a clean migration over zero records.
const checkoutRootFrom = (args: {
  readonly search: string;
  readonly fileSystem: FileSystemCapabilities;
}): string | null => {
  if (
    args.fileSystem.directoryExists({
      path: join(args.search, CHECKOUT_MARKER),
    })
  )
    return args.search;
  const parent = dirname(args.search);
  return parent === args.search
    ? null
    : checkoutRootFrom({ search: parent, fileSystem: args.fileSystem });
};

const resolveIntentsRoot = (args: {
  readonly from: string;
  readonly fileSystem: FileSystemCapabilities;
}): IntentsRootResolution => {
  const checkoutRoot = checkoutRootFrom({
    search: args.from,
    fileSystem: args.fileSystem,
  });
  if (checkoutRoot === null)
    return { kind: "no-checkout-root", from: args.from };
  const intentsRoot = join(checkoutRoot, ...INTENTS_SEGMENTS);
  return args.fileSystem.directoryExists({ path: intentsRoot })
    ? { kind: "resolved", intentsRoot }
    : { kind: "intents-root-absent", expected: intentsRoot };
};

const run = (args: {
  readonly argv: readonly string[];
  readonly from: string;
  readonly fileSystem: FileSystemCapabilities;
  readonly derivations: RecordStore;
  readonly bindings: RecordStore;
  readonly clock: Clock;
  readonly output: Output;
}): number => {
  const resolution = resolveIntentsRoot({
    from: args.from,
    fileSystem: args.fileSystem,
  });
  if (resolution.kind === "no-checkout-root") {
    args.output.writeError({
      line: `rin-gates-tier-migration: no ${CHECKOUT_MARKER} found above ${resolution.from}`,
    });
    return 1;
  }
  if (resolution.kind === "intents-root-absent") {
    args.output.writeError({
      line: `rin-gates-tier-migration: intents root absent at ${resolution.expected}`,
    });
    return 1;
  }

  const ratifiedMilestones = resolveRatifiedMilestones({
    toolsDir: args.from,
    fileSystem: args.fileSystem,
  });
  if (ratifiedMilestones.kind === "config-unreadable") {
    args.output.writeError({
      line: `rin-gates-tier-migration: selection ranking config is unreadable at ${ratifiedMilestones.path}`,
    });
    return 1;
  }
  if (ratifiedMilestones.kind === "config-malformed") {
    args.output.writeError({
      line: `rin-gates-tier-migration: selection ranking config is malformed (${ratifiedMilestones.path}): ${ratifiedMilestones.detail}`,
    });
    return 1;
  }

  const gathered = gatherMigrationRecords({
    intentsRoot: resolution.intentsRoot,
    derivations: args.derivations,
    bindings: args.bindings,
    ratifiedMilestones: ratifiedMilestones.ratifiedMilestones,
  });
  if (gathered.outcome === "failed") {
    args.output.writeError({ line: renderGatherFailure(gathered.error) });
    return 1;
  }

  const report = runTierMigration({
    records: gathered.value,
    clock: args.clock,
  });

  args.output.writeOut({
    line: args.argv.includes("--json")
      ? JSON.stringify(report, null, 2)
      : renderMigrationSummary({ report }),
  });
  return 0;
};

if (import.meta.main)
  process.exitCode = run({
    argv: process.argv.slice(2),
    from: dirname(fileURLToPath(import.meta.url)),
    fileSystem: nodeFileSystemCapabilities,
    derivations: createNodeRecordStore({
      bindingFilename: DERIVATION_FILENAME,
    }),
    bindings: createNodeRecordStore({
      bindingFilename: IMPORTANCE_BINDING_FILENAME,
    }),
    clock: createSystemClock(),
    output: {
      writeOut: ({ line }) => process.stdout.write(`${line}\n`),
      writeError: ({ line }) => process.stderr.write(`${line}\n`),
    },
  });

export {
  type Output,
  type RatifiedMilestonesResolution,
  resolveIntentsRoot,
  resolveRatifiedMilestones,
  run,
};
