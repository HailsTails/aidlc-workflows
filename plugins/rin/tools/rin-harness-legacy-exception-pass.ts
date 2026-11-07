import { join } from "node:path";
import { z } from "zod";
import type { R7OptIn } from "./rin-harness-config.ts";
import {
  BASELINE_RESTORE_REMEDY,
  type BaselineLoad,
  type BaselineUnreadable,
  type ExceptionEntryLocation,
  entryDigest,
  loadBaseline,
} from "./rin-harness-exception-baseline.ts";
import {
  defaultSidecarFileReader,
  type SidecarFileReader,
} from "./rin-harness-sidecar-file-reader.ts";
import { whyChainProblem } from "./rin-harness-why-chain.ts";

const REGISTRY_DIRECTORIES = [
  ".constitution-carve-outs",
  ".constitution-authorised-locations",
] as const;

type LegacyExceptionEntry = ExceptionEntryLocation & {
  readonly files: readonly string[];
  readonly problem: string;
};

type RegistryUnreadable = "registry-unreadable" | "registry-unparseable" | "registry-not-array";
type UnmeasurableReason = BaselineUnreadable | RegistryUnreadable | "config-invalid";
type RegistryEntry = ExceptionEntryLocation & { readonly entry: unknown };
type RegistryEntries =
  | { readonly kind: "read"; readonly entries: readonly RegistryEntry[] }
  | { readonly kind: "unreadable"; readonly reason: RegistryUnreadable };

type PassMeasurement =
  | { readonly kind: "measured" }
  | { readonly kind: "not-opted-in" }
  | { readonly kind: "unmeasurable"; readonly reason: UnmeasurableReason };

type LegacyExceptionPass = {
  readonly owing: readonly LegacyExceptionEntry[];
  readonly scanned: number;
  readonly legacy: number;
  readonly chained: number;
  readonly measurement: PassMeasurement;
};

const isRecord = (
  candidate: unknown,
): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === "object" &&
  candidate !== null &&
  !Array.isArray(candidate);

const filesOf = ({ entry }: { readonly entry: unknown }): readonly string[] => {
  if (!isRecord(entry) || !Array.isArray(entry["files"])) return [];
  return entry["files"].filter((file): file is string => typeof file === "string");
};

const problemFor = ({
  entry,
}: {
  readonly entry: unknown;
}): string | undefined => {
  if (!isRecord(entry)) return "entry is not a JSON object";
  if (entry["whyChain"] === undefined) {
    return "carries no whyChain — its recorded reason names a program or a symptom, never a cause";
  }
  const problem = whyChainProblem(entry["whyChain"]);
  return problem === undefined
    ? undefined
    : `whyChain is incomplete: ${problem}`;
};

const entriesIn = ({
  registry,
  projectDir,
  reader,
}: {
  readonly registry: string;
  readonly projectDir: string;
  readonly reader: SidecarFileReader;
}): RegistryEntries => {
  const names = reader.listDirectory(join(projectDir, registry));
  if (names === undefined) return { kind: "unreadable", reason: "registry-unreadable" };
  return names.filter((name) => name.endsWith(".json")).reduce<RegistryEntries>((result, sidecar) => {
    if (result.kind === "unreadable") return result;
    const raw = reader.readFile(join(projectDir, registry, sidecar));
    if (raw === undefined) return { kind: "unreadable", reason: "registry-unreadable" };
    try {
      const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
      if (!parsed.success) return { kind: "unreadable", reason: "registry-not-array" };
      return {
        kind: "read",
        entries: [...result.entries, ...parsed.data.map((entry: unknown, index) => ({ registry, sidecar, entry, index }))],
      };
    } catch {
      return { kind: "unreadable", reason: "registry-unparseable" };
    }
  }, { kind: "read", entries: [] });
};

const measurementOf = ({
  baseline,
}: {
  readonly baseline: BaselineLoad;
}): PassMeasurement => {
  if (baseline.kind === "unreadable") {
    return { kind: "unmeasurable", reason: baseline.reason };
  }
  return { kind: "measured" };
};

const unscannedPass = ({
  measurement,
}: {
  readonly measurement: PassMeasurement;
}): LegacyExceptionPass => ({
  owing: [],
  scanned: 0,
  legacy: 0,
  chained: 0,
  measurement,
});

const scannedPass = ({
  projectDir,
  reader,
}: {
  readonly projectDir: string;
  readonly reader: SidecarFileReader;
}): LegacyExceptionPass => {
  const baseline = loadBaseline({ projectDir, reader });
  const population = REGISTRY_DIRECTORIES.reduce<RegistryEntries>((result, registry) => {
    if (result.kind === "unreadable") return result;
    const found = entriesIn({ registry, projectDir, reader });
    if (found.kind === "unreadable") return found;
    return { kind: "read", entries: [...result.entries, ...found.entries] };
  }, { kind: "read", entries: [] });
  if (population.kind === "unreadable") {
    return unscannedPass({ measurement: { kind: "unmeasurable", reason: population.reason } });
  }
  const all = population.entries;
  const legacyDigests =
    baseline.kind === "loaded" ? baseline.digests : new Set<string>();
  const legacy = all.filter((found) =>
    legacyDigests.has(
      entryDigest({
        entry: found.entry,
        origin: { registry: found.registry, sidecar: found.sidecar },
      }),
    ),
  );
  const owing = legacy.flatMap((found) => {
    const problem = problemFor({ entry: found.entry });
    return problem === undefined
      ? []
      : [
          {
            registry: found.registry,
            sidecar: found.sidecar,
            index: found.index,
            files: filesOf({ entry: found.entry }),
            problem,
          },
        ];
  });
  return {
    owing,
    scanned: all.length,
    legacy: legacy.length,
    chained: legacy.length - owing.length,
    measurement: measurementOf({ baseline }),
  };
};

const legacyExceptionPass = ({
  projectDir,
  optIn,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly optIn: R7OptIn;
  readonly reader?: SidecarFileReader;
}): LegacyExceptionPass => {
  switch (optIn.kind) {
    case "enabled":
      return scannedPass({ projectDir, reader });
    case "disabled":
      return unscannedPass({ measurement: { kind: "not-opted-in" } });
    case "invalid":
      return unscannedPass({
        measurement: { kind: "unmeasurable", reason: "config-invalid" },
      });
  }
};

type PassReport = {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
};

const CLEAN_EXIT = 0;
const UNMEASURABLE_EXIT = 1;

const REMEDY: Readonly<Record<UnmeasurableReason, string>> = {
  "registry-unreadable": "a constitution registry directory or listed sidecar could not be read, so its population cannot be measured. Restore readable registry files",
  "registry-unparseable": "a listed constitution registry sidecar is invalid JSON, so its population cannot be measured. Repair the registry sidecar",
  "registry-not-array": "a listed constitution registry sidecar is not a JSON array, so its population cannot be measured. Repair the registry sidecar",
  absent: `the baseline file is missing, so no entry can resolve as legacy and every figure below would be meaningless. ${BASELINE_RESTORE_REMEDY}`,
  "unreadable-io": `the baseline file exists but could not be read, so no entry can resolve as legacy. ${BASELINE_RESTORE_REMEDY}`,
  "config-invalid":
    "harness.config.json is invalid, so whether this project opted in to R7 cannot be established. Correct harness.config.json",
  unparseable: `the baseline file is not readable as a digest list, so no entry can resolve as legacy. ${BASELINE_RESTORE_REMEDY}`,
  truncated: `the baseline file holds fewer digests than it declares, so it is partial rather than smaller. ${BASELINE_RESTORE_REMEDY}`,
  width: `the baseline's digests are a different width than \`entryDigest\` now produces, so no entry can resolve. ${BASELINE_RESTORE_REMEDY}`,
};

const measuredReport = ({
  pass,
}: {
  readonly pass: LegacyExceptionPass;
}): PassReport => {
  const owingLines = pass.owing
    .map(
      (entry) =>
        `  ${entry.registry}/${entry.sidecar}[${entry.index}] — ${entry.problem}\n    files: ${entry.files.join(", ")}\n`,
    )
    .join("");
  const advisory =
    pass.owing.length > 0
      ? "\nAdvisory (project.md § R7): these predate the whyChain requirement and are exempt from the REFUSAL, not grandfathered. Each owes a real chain when next touched — modifying one drops it from the legacy baseline and the loader will then demand its chain (CD-46 touch-closure).\n"
      : "";
  return {
    exitCode: CLEAN_EXIT,
    stderr: "",
    stdout: `R7 legacy-exception pass: ${pass.owing.length} of ${pass.legacy} legacy entr${
      pass.legacy === 1 ? "y" : "ies"
    } owe a Five Whys chain (${pass.chained} carry one); ${pass.scanned} scanned.\n${owingLines}${advisory}`,
  };
};

const passReport = ({
  pass,
}: {
  readonly pass: LegacyExceptionPass;
}): PassReport => {
  switch (pass.measurement.kind) {
    case "not-opted-in":
      return {
        exitCode: CLEAN_EXIT,
        stderr: "",
        stdout:
          "R7 legacy-exception pass: this project has not opted in (rinGates.exceptionWhyChains), so no baseline is required.\n",
      };
    case "unmeasurable":
      return {
        exitCode: UNMEASURABLE_EXIT,
        stderr: `R7 legacy-exception pass: ${REMEDY[pass.measurement.reason]}.\n`,
        stdout: "",
      };
    case "measured":
      return measuredReport({ pass });
  }
};

export type {
  LegacyExceptionEntry,
  LegacyExceptionPass,
  PassMeasurement,
  PassReport,
  UnmeasurableReason,
};
export {
  CLEAN_EXIT,
  legacyExceptionPass,
  passReport,
  REGISTRY_DIRECTORIES,
  UNMEASURABLE_EXIT,
};
