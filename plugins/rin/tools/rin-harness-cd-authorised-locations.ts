import { join } from "node:path";
import { configR7OptIn } from "./rin-harness-config.ts";
import {
  type ChainBaseline,
  chainBaselineFor,
  whyChainProblemForEntry,
} from "./rin-harness-exception-baseline.ts";
import {
  defaultSidecarFileReader,
  type SidecarFileReader,
} from "./rin-harness-sidecar-file-reader.ts";
import { parsedWhyChain, type WhyChain } from "./rin-harness-why-chain.ts";

type AuthorisedLocation = {
  readonly files: readonly string[];
  readonly reason: string;
  readonly whyChain?: WhyChain;
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

const entryProblem = ({
  entry,
  baseline,
  sidecar,
}: {
  readonly entry: unknown;
  readonly baseline: ChainBaseline;
  readonly sidecar: string;
}): string | undefined => {
  if (!isRecord(entry)) return "entry is not a JSON object";
  if (!isNonEmptyStringArray(entry.files)) {
    return "`files` must be a non-empty array of non-empty strings";
  }
  if (!isNonEmptyString(entry.reason)) {
    return "`reason` is required and must be a non-empty string";
  }
  return whyChainProblemForEntry({
    entry,
    baseline,
    origin: { registry: AUTHORISED_LOCATION_DIR, sidecar },
  });
};

const validatedEntries = ({
  parsed,
  cdId,
  sidecar,
  baseline,
}: {
  readonly parsed: unknown;
  readonly cdId: string;
  readonly sidecar: string;
  readonly baseline: ChainBaseline;
}): SidecarLoad => {
  if (!Array.isArray(parsed)) {
    return {
      outcome: "rejected",
      rejection: { sidecar, problem: "top level must be a JSON array" },
    };
  }
  const problems = parsed.flatMap((entry, index) => {
    const problem = entryProblem({ entry, baseline, sidecar });
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
      return [
        { cd: cdId, files, reason, whyChain: parsedWhyChain(entry.whyChain) },
      ];
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
  const optIn = configR7OptIn({ projectDir });
  if (optIn.kind === "invalid") {
    return {
      outcome: "rejected",
      rejection: {
        sidecar,
        problem: `harness.config.json is invalid: ${optIn.reason}`,
      },
    };
  }
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
  return validatedEntries({
    parsed: json.parsed,
    cdId,
    sidecar,
    baseline: chainBaselineFor({ optIn, projectDir, reader }),
  });
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
