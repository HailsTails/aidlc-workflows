import { basename, join } from "node:path";
import type { CarveOut } from "./constitution-audit/index.ts";
import {
  defaultSidecarFileReader,
  type SidecarFileReader,
} from "./rin-harness-sidecar-file-reader.ts";

type CdCarveOut = {
  readonly files: readonly string[];
  readonly reason: string;
  readonly decision: string;
};

type OwnedCarveOut = CdCarveOut & {
  readonly cd: string;
};

type CarveOutSidecarRejection = {
  readonly sidecar: string;
  readonly problem: string;
};

type CarveOutSidecarLoad =
  | {
      readonly outcome: "loaded";
      readonly entries: readonly OwnedCarveOut[];
    }
  | {
      readonly outcome: "rejected";
      readonly rejection: CarveOutSidecarRejection;
    };

const CARVE_OUT_DIR = ".constitution-carve-outs";
const SENTINEL_SERVICE = "__aidlc_cd_owned__";

const carveOutDir = (projectDir: string): string =>
  join(projectDir, CARVE_OUT_DIR);

const sidecarName = (cdId: string): string => `${cdId.toLowerCase()}.json`;

const isRecord = (
  candidate: unknown,
): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === "object" &&
  candidate !== null &&
  !Array.isArray(candidate);

const isNonEmptyString = (candidate: unknown): candidate is string =>
  typeof candidate === "string" && candidate.trim().length > 0;

const isNonEmptyStringArray = (
  candidate: unknown,
): candidate is readonly string[] =>
  Array.isArray(candidate) &&
  candidate.length > 0 &&
  candidate.every(isNonEmptyString);

const parsedJson = (raw: string): { readonly parsed: unknown } | undefined => {
  try {
    return { parsed: JSON.parse(raw) as unknown };
  } catch {
    return undefined;
  }
};

const entryProblem = (entry: unknown): string | undefined => {
  if (!isRecord(entry)) return "entry is not a JSON object";
  if (!isNonEmptyStringArray(entry.files)) {
    return "`files` must be a non-empty array of non-empty strings";
  }
  if (!isNonEmptyString(entry.reason)) {
    return "`reason` is required and must be a non-empty string";
  }
  if (!isNonEmptyString(entry.decision)) {
    return "`decision` is required and must be a non-empty string naming the carve-out's provenance";
  }
  return undefined;
};

const validatedEntries = ({
  parsed,
  cdId,
  sidecar,
}: {
  readonly parsed: unknown;
  readonly cdId: string;
  readonly sidecar: string;
}): CarveOutSidecarLoad => {
  if (!Array.isArray(parsed)) {
    return {
      outcome: "rejected",
      rejection: { sidecar, problem: "top level must be a JSON array" },
    };
  }
  const problems = parsed.flatMap((entry, index) => {
    const problem = entryProblem(entry);
    return problem === undefined ? [] : [`entry ${index}: ${problem}`];
  });
  if (problems.length > 0) {
    return {
      outcome: "rejected",
      rejection: { sidecar, problem: problems.join("; ") },
    };
  }
  return {
    outcome: "loaded",
    entries: parsed.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const { files, reason, decision } = entry;
      if (
        !isNonEmptyStringArray(files) ||
        !isNonEmptyString(reason) ||
        !isNonEmptyString(decision)
      ) {
        return [];
      }
      return [{ cd: cdId, files, reason, decision }];
    }),
  };
};

const loadCarveOutSidecarForCd = ({
  projectDir,
  cdId,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly cdId: string;
  readonly reader?: SidecarFileReader;
}): CarveOutSidecarLoad => {
  const sidecar = sidecarName(cdId);
  const path = join(carveOutDir(projectDir), sidecar);
  if (!reader.fileExists(path)) return { outcome: "loaded", entries: [] };
  const raw = reader.readFile(path);
  if (raw === undefined) {
    return {
      outcome: "rejected",
      rejection: { sidecar, problem: "sidecar exists but could not be read" },
    };
  }
  const json = parsedJson(raw);
  if (json === undefined) {
    return {
      outcome: "rejected",
      rejection: { sidecar, problem: "sidecar is not valid JSON" },
    };
  }
  return validatedEntries({ parsed: json.parsed, cdId, sidecar });
};

const loadOwnedCarveOutsForCd = ({
  projectDir,
  cdId,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly cdId: string;
  readonly reader?: SidecarFileReader;
}): readonly OwnedCarveOut[] => {
  const load = loadCarveOutSidecarForCd({ projectDir, cdId, reader });
  if (load.outcome === "rejected") {
    process.stderr.write(
      `carve-outs: REJECTED ${load.rejection.sidecar} — ${load.rejection.problem}. No exemption is granted from a malformed sidecar.\n`,
    );
    process.exit(1);
  }
  return load.entries;
};

const loadCarveOutsForCd = ({
  projectDir,
  cdId,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly cdId: string;
  readonly reader?: SidecarFileReader;
}): readonly CarveOut[] =>
  loadOwnedCarveOutsForCd({ projectDir, cdId, reader }).map((owned) => ({
    service: SENTINEL_SERVICE,
    cdCode: owned.cd,
    spec: owned.decision,
    files: owned.files,
  }));

const listCarveOutCds = ({
  projectDir,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly reader?: SidecarFileReader;
}): readonly string[] =>
  reader
    .listDirectory(carveOutDir(projectDir))
    .filter((name) => /^cd-.*\.json$/.test(name))
    .map((name) => basename(name, ".json").toUpperCase())
    .sort();

const loadAllOwnedCarveOuts = ({
  projectDir,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly reader?: SidecarFileReader;
}): readonly OwnedCarveOut[] =>
  listCarveOutCds({ projectDir, reader }).flatMap((cdId) =>
    loadOwnedCarveOutsForCd({ projectDir, cdId, reader }),
  );

export type {
  CarveOutSidecarLoad,
  CarveOutSidecarRejection,
  CdCarveOut,
  OwnedCarveOut,
};
export {
  CARVE_OUT_DIR,
  carveOutDir,
  listCarveOutCds,
  loadAllOwnedCarveOuts,
  loadCarveOutSidecarForCd,
  loadCarveOutsForCd,
  loadOwnedCarveOutsForCd,
  SENTINEL_SERVICE,
  sidecarName,
};
