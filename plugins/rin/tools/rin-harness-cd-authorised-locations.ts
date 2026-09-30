import { join } from "node:path";
import {
  defaultSidecarFileReader,
  type SidecarFileReader,
} from "./rin-harness-sidecar-file-reader.ts";

type AuthorisedLocation = {
  readonly files: readonly string[];
  readonly reason: string;
};

type OwnedAuthorisedLocation = AuthorisedLocation & {
  readonly cd: string;
};

type SidecarRejection = {
  readonly sidecar: string;
  readonly problem: string;
};

type SidecarLoad =
  | {
      readonly outcome: "loaded";
      readonly entries: readonly OwnedAuthorisedLocation[];
    }
  | { readonly outcome: "rejected"; readonly rejection: SidecarRejection };

const AUTHORISED_LOCATION_DIR = ".constitution-authorised-locations";

const authorisedLocationDir = (projectDir: string): string =>
  join(projectDir, AUTHORISED_LOCATION_DIR);

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
}): SidecarLoad => {
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
      const { files, reason } = entry;
      if (!isNonEmptyStringArray(files) || !isNonEmptyString(reason)) return [];
      return [{ cd: cdId, files, reason }];
    }),
  };
};

const loadSidecarForCd = ({
  projectDir,
  cdId,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly cdId: string;
  readonly reader?: SidecarFileReader;
}): SidecarLoad => {
  const sidecar = sidecarName(cdId);
  const path = join(authorisedLocationDir(projectDir), sidecar);
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

const loadAuthorisedLocationsForCd = ({
  projectDir,
  cdId,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly cdId: string;
  readonly reader?: SidecarFileReader;
}): readonly OwnedAuthorisedLocation[] => {
  const load = loadSidecarForCd({ projectDir, cdId, reader });
  if (load.outcome === "rejected") {
    process.stderr.write(
      `authorised-locations: REJECTED ${load.rejection.sidecar} — ${load.rejection.problem}. No authorisation is granted from a malformed sidecar.\n`,
    );
    process.exit(1);
  }
  return load.entries;
};

export type {
  AuthorisedLocation,
  OwnedAuthorisedLocation,
  SidecarLoad,
  SidecarRejection,
};
export {
  AUTHORISED_LOCATION_DIR,
  authorisedLocationDir,
  loadAuthorisedLocationsForCd,
  loadSidecarForCd,
  sidecarName,
};
