import type { ReviewDecodersPort } from "../tools/rin-gates/review-decoders-port.ts";
import {
  gateDirSegments,
  type GateSlug,
  isGateSlug,
  GATE_PHASES,
} from "../tools/rin-gates/rin-gate-namespace.ts";
import {
  type AttemptLedgerEntry,
  type BoundedClosePolicy,
  CLOSE_RECEIPT_FILENAME,
  type CloseReceipt,
  earlierGatesOf,
  inboundRowsOf,
  laterBoardGatesOf,
  SYNTHESIS_LENS,
} from "../tools/rin-gates/rin-gates-bounded-close.ts";
import type { FileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import type { RosterResolution } from "./shared-review-roster.ts";

type BoundedCloseStorePorts = {
  readonly files: Pick<
    FileTextPort,
    "exists" | "read" | "write" | "append" | "mkdir"
  >;
  readonly decoders: Pick<
    ReviewDecodersPort,
    "attemptLedgerEntry" | "closeReceipt"
  >;
  readonly join: (...segments: string[]) => string;
  readonly dirname: (path: string) => string;
};

type BoundedCloseStore = {
  readonly readLedger: (attempt: {
    readonly recordName: string;
    readonly gate: GateSlug;
  }) => readonly AttemptLedgerEntry[];
  readonly appendLedger: (addition: {
    readonly recordName: string;
    readonly gate: GateSlug;
    readonly entry: AttemptLedgerEntry;
  }) => void;
  readonly readReceipt: (location: {
    readonly recordDir: string;
    readonly gate: GateSlug;
  }) => CloseReceipt | null;
  readonly writeReceipt: (publication: {
    readonly recordDir: string;
    readonly receipt: CloseReceipt;
  }) => void;
};

const ATTEMPTS_SUBDIRECTORY = "attempts";

const decodedLine = <Value>({
  line,
  decode,
}: {
  readonly line: string;
  readonly decode: (
    value: unknown,
  ) => { readonly success: true; readonly data: Value } | { readonly success: false };
}): readonly Value[] => {
  try {
    const decoded = decode(JSON.parse(line));
    return decoded.success ? [decoded.data] : [];
  } catch {
    return [];
  }
};

type CloseReceiptReaderPorts = {
  readonly files: Pick<FileTextPort, "exists" | "read">;
  readonly decoders: Pick<ReviewDecodersPort, "closeReceipt">;
  readonly join: (...segments: string[]) => string;
};

const closeReceiptPathOf = ({
  recordDir,
  gate,
  join,
}: {
  readonly recordDir: string;
  readonly gate: GateSlug;
  readonly join: (...segments: string[]) => string;
}): string =>
  join(recordDir, ...(gateDirSegments(gate) ?? []), CLOSE_RECEIPT_FILENAME);

const closeReceiptReader =
  ({
    ports,
  }: {
    readonly ports: CloseReceiptReaderPorts;
  }): BoundedCloseStore["readReceipt"] =>
  ({ recordDir, gate }) => {
    const path = closeReceiptPathOf({ recordDir, gate, join: ports.join });
    if (!ports.files.exists(path)) return null;
    return (
      decodedLine({
        line: ports.files.read(path, "utf-8"),
        decode: ports.decoders.closeReceipt,
      })[0] ?? null
    );
  };

const boundedCloseStore = ({
  ports,
  capturesDirectory,
}: {
  readonly ports: BoundedCloseStorePorts;
  readonly capturesDirectory: string;
}): BoundedCloseStore => {
  const { files, decoders, join, dirname } = ports;
  const ledgerPath = ({
    recordName,
    gate,
  }: {
    readonly recordName: string;
    readonly gate: GateSlug;
  }): string =>
    join(
      capturesDirectory,
      ATTEMPTS_SUBDIRECTORY,
      `${recordName}.${gate}.attempt.jsonl`,
    );
  return {
    readLedger: (attempt) => {
      const path = ledgerPath(attempt);
      if (!files.exists(path)) return [];
      return files
        .read(path, "utf-8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .flatMap((line) =>
          decodedLine({ line, decode: decoders.attemptLedgerEntry }),
        );
    },
    appendLedger: ({ recordName, gate, entry }) => {
      const path = ledgerPath({ recordName, gate });
      files.mkdir(dirname(path), { recursive: true });
      files.append(path, `${JSON.stringify(entry)}\n`, "utf-8");
    },
    readReceipt: closeReceiptReader({ ports: { files, decoders, join } }),
    writeReceipt: ({ recordDir, receipt }) => {
      const path = closeReceiptPathOf({
        recordDir,
        gate: receipt.gate,
        join,
      });
      files.mkdir(dirname(path), { recursive: true });
      files.write(path, `${JSON.stringify(receipt, null, 2)}\n`, "utf-8");
    },
  };
};

const ALL_GATES: readonly GateSlug[] =
  Object.keys(GATE_PHASES).filter(isGateSlug);

const boardGatesOf = ({
  rosterFor,
}: {
  readonly rosterFor: (gate: string) => RosterResolution;
}): readonly GateSlug[] =>
  ALL_GATES.filter((gate) => {
    const resolution = rosterFor(gate);
    return (
      resolution.kind !== "unreadable" &&
      resolution.roster.includes(SYNTHESIS_LENS)
    );
  });

const inboundRowsFor = ({
  gate,
  recordDir,
  store,
}: {
  readonly gate: GateSlug;
  readonly recordDir: string;
  readonly store: Pick<BoundedCloseStore, "readReceipt">;
}): BoundedClosePolicy["inboundRows"] =>
  inboundRowsOf({
    gate,
    earlierReceipts: earlierGatesOf({ gate }).flatMap((earlier) => {
      const receipt = store.readReceipt({ recordDir, gate: earlier });
      return receipt === null ? [] : [receipt];
    }),
  });

const boundedClosePolicyFor = ({
  gate,
  recordDir,
  rosterFor,
  store,
  exceptionWhyChainsEnabled,
}: {
  readonly gate: string;
  readonly recordDir: string;
  readonly rosterFor: (gate: string) => RosterResolution;
  readonly store: Pick<BoundedCloseStore, "readReceipt">;
  readonly exceptionWhyChainsEnabled: boolean;
}): BoundedClosePolicy | null => {
  if (!isGateSlug(gate)) return null;
  const resolution = rosterFor(gate);
  if (
    resolution.kind === "unreadable" ||
    !resolution.roster.includes(SYNTHESIS_LENS)
  ) {
    return null;
  }
  return {
    gate,
    roster: resolution.roster,
    inboundRows: inboundRowsFor({ gate, recordDir, store }),
    forwardableGates: laterBoardGatesOf({
      gate,
      boardGates: boardGatesOf({ rosterFor }),
    }),
    exceptionWhyChainsEnabled,
  };
};

export type { BoundedCloseStore, BoundedCloseStorePorts };
export {
  boundedClosePolicyFor,
  boundedCloseStore,
  closeReceiptReader,
  inboundRowsFor,
};
