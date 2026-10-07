import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { SettledR7OptIn } from "./rin-harness-config.ts";
import {
  defaultSidecarFileReader,
  type SidecarFileReader,
} from "./rin-harness-sidecar-file-reader.ts";
import { whyChainProblem } from "./rin-harness-why-chain.ts";

const BASELINE_FILENAME = ".r7-legacy-baseline.json";

const BASELINE_RESTORE_REMEDY = `Restore the tracked ${BASELINE_FILENAME} from version control (\`git checkout -- ${BASELINE_FILENAME}\`)`;

const DIGEST_LENGTH = 16;

const baselineFileSchema = z.object({
  digests: z.array(z.string()),
  entryCount: z.number(),
});

type BaselineFile = z.infer<typeof baselineFileSchema>;

type BaselineUnreadable =
  | "absent"
  | "unreadable-io"
  | "unparseable"
  | "truncated"
  | "width";

const parseBaselineFile = ({
  raw,
}: {
  readonly raw: string;
}): BaselineFile | undefined => {
  try {
    const parsed = baselineFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

type BaselineLoad =
  | { readonly kind: "loaded"; readonly digests: ReadonlySet<string> }
  | { readonly kind: "unreadable"; readonly reason: BaselineUnreadable };

type ChainBaseline = { readonly kind: "not-opted-in" } | BaselineLoad;

const NOT_OPTED_IN: ChainBaseline = { kind: "not-opted-in" };

type ExceptionEntryOrigin = {
  readonly registry: string;
  readonly sidecar: string;
};

type ExceptionEntryLocation = ExceptionEntryOrigin & {
  readonly index: number;
};

const isRecord = (
  candidate: unknown,
): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === "object" &&
  candidate !== null &&
  !Array.isArray(candidate);

const baselinePath = (projectDir: string): string =>
  join(projectDir, BASELINE_FILENAME);

const entryDigest = ({
  entry,
  origin,
}: {
  readonly entry: unknown;
  readonly origin: ExceptionEntryOrigin;
}): string =>
  createHash("sha256")
    .update(JSON.stringify([origin.registry, origin.sidecar, entry]))
    .digest("hex")
    .slice(0, DIGEST_LENGTH);

const loadBaseline = ({
  projectDir,
  reader = defaultSidecarFileReader(),
}: {
  readonly projectDir: string;
  readonly reader?: SidecarFileReader;
}): BaselineLoad => {
  const path = baselinePath(projectDir);
  if (!reader.fileExists(path)) {
    return { kind: "unreadable", reason: "absent" };
  }
  const raw = reader.readFile(path);
  if (raw === undefined) {
    return { kind: "unreadable", reason: "unreadable-io" };
  }
  const parsed = parseBaselineFile({ raw });
  if (parsed === undefined) {
    return { kind: "unreadable", reason: "unparseable" };
  }
  if (parsed.entryCount !== parsed.digests.length) {
    return { kind: "unreadable", reason: "truncated" };
  }
  if (parsed.digests.some((digest) => digest.length !== DIGEST_LENGTH)) {
    return { kind: "unreadable", reason: "width" };
  }
  return { kind: "loaded", digests: new Set(parsed.digests) };
};

const chainBaselineFor = ({
  optIn,
  projectDir,
  reader = defaultSidecarFileReader(),
}: {
  readonly optIn: SettledR7OptIn;
  readonly projectDir: string;
  readonly reader?: SidecarFileReader;
}): ChainBaseline => {
  switch (optIn.kind) {
    case "enabled":
      return loadBaseline({ projectDir, reader });
    case "disabled":
      return NOT_OPTED_IN;
  }
};

const baselineIsMeasurable = ({
  baseline,
}: {
  readonly baseline: BaselineLoad;
}): boolean =>
  baseline.kind === "loaded" &&
  [...baseline.digests].every((digest) => digest.length === DIGEST_LENGTH);

const whyChainProblemForEntry = ({
  entry,
  baseline,
  origin,
}: {
  readonly entry: unknown;
  readonly baseline: ChainBaseline;
  readonly origin: ExceptionEntryOrigin;
}): string | undefined => {
  if (baseline.kind === "not-opted-in") {
    return undefined;
  }
  if (baseline.kind === "unreadable") {
    return `the R7 legacy baseline (${BASELINE_FILENAME}) is ${baseline.reason}, so legacy status cannot be established. ${BASELINE_RESTORE_REMEDY} — absence is not an exemption.`;
  }
  if (baseline.digests.has(entryDigest({ entry, origin }))) {
    return undefined;
  }
  const whyChain = isRecord(entry) ? entry["whyChain"] : undefined;
  if (whyChain === undefined) {
    return "`whyChain` is required on every exception entry added or modified from this commit (project.md § R7). A legacy entry is exempt from this refusal by digest; this entry is not in that set.";
  }
  const problem = whyChainProblem(whyChain);
  return problem === undefined
    ? undefined
    : `\`whyChain\` is incomplete: ${problem}`;
};

export type {
  BaselineLoad,
  BaselineUnreadable,
  ChainBaseline,
  ExceptionEntryLocation,
  ExceptionEntryOrigin,
};
export {
  BASELINE_FILENAME,
  BASELINE_RESTORE_REMEDY,
  baselineIsMeasurable,
  baselinePath,
  chainBaselineFor,
  DIGEST_LENGTH,
  entryDigest,
  loadBaseline,
  NOT_OPTED_IN,
  whyChainProblemForEntry,
};
