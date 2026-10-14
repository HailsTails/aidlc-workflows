import { z } from "zod";
import type { LoadFailure } from "../check/load-failure.ts";
import type { Selection } from "../consumer-selection/consumer-selection.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { readVersionOneJson } from "../rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import {
  type ClauseAddress,
  clauseAddressSchema,
  sameClauseAddress,
} from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { type WhyChain, whyChainSchema } from "../values/why-chain.ts";

export type ExceptionsFile = {
  readonly version: 1;
  readonly exceptions: readonly (
    | {
        readonly kind: "authorised-location";
        readonly clause: string;
        readonly file: string;
        readonly reason: string;
      }
    | {
        readonly kind: "file-carve-out";
        readonly clause: string;
        readonly file: string;
        readonly reason: string;
        readonly whyChain: unknown;
      }
    | {
        readonly kind: "clause-wide-carve-out";
        readonly clause: string;
        readonly reason: string;
        readonly whyChain: unknown;
      }
  )[];
};

export type ExceptionRecord =
  | {
      readonly kind: "authorised-location";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason: string;
    }
  | {
      readonly kind: "file-carve-out";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason: string;
      readonly whyChain: WhyChain;
    }
  | {
      readonly kind: "clause-wide-carve-out";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly reason: string;
      readonly whyChain: WhyChain;
    };

export type InvalidRecord = {
  readonly index: number;
  readonly problem:
    | { readonly kind: "clause-unparseable"; readonly detail: string }
    | { readonly kind: "clause-not-selected"; readonly clause: ClauseAddress }
    | { readonly kind: "file-not-repo-path"; readonly file: string }
    | { readonly kind: "why-chain-refused"; readonly detail: string }
    | { readonly kind: "duplicate"; readonly ofIndex: number };
};

type ExceptionEntry = ExceptionsFile["exceptions"][number];

type IndexedRecord = { readonly index: number; readonly record: ExceptionRecord };

type EntryProblem = InvalidRecord["problem"];

const exceptionsFileSchema = z.object({
  version: z.literal(1),
  exceptions: z.array(
    z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("authorised-location"),
        clause: z.string(),
        file: z.string(),
        reason: z.string(),
      }),
      z.strictObject({
        kind: z.literal("file-carve-out"),
        clause: z.string(),
        file: z.string(),
        reason: z.string(),
        whyChain: z.unknown(),
      }),
      z.strictObject({
        kind: z.literal("clause-wide-carve-out"),
        clause: z.string(),
        reason: z.string(),
        whyChain: z.unknown(),
      }),
    ]),
  ),
});

const recordedFile = (request: {
  readonly file: string;
}): Result<RepoPath, EntryProblem> => {
  const parsed = repoPathSchema.safeParse(request.file);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : { outcome: "failed", error: { kind: "file-not-repo-path", file: request.file } };
};

const recordedWhyChain = (request: {
  readonly whyChain: unknown;
}): Result<WhyChain, EntryProblem> => {
  const parsed = whyChainSchema.safeParse(request.whyChain);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : {
        outcome: "failed",
        error: { kind: "why-chain-refused", detail: z.prettifyError(parsed.error) },
      };
};

const parsedRecord = (request: {
  readonly entry: ExceptionEntry;
  readonly selection: Selection;
}): Result<ExceptionRecord, EntryProblem> => {
  const { entry } = request;
  const address = clauseAddressSchema.safeParse(entry.clause);
  if (!address.success) {
    return {
      outcome: "failed",
      error: { kind: "clause-unparseable", detail: z.prettifyError(address.error) },
    };
  }
  const clause = address.data;
  const selected = request.selection.selected.find((candidate) =>
    sameClauseAddress({ left: candidate.address, right: clause }) === "same",
  );
  if (selected === undefined) {
    return { outcome: "failed", error: { kind: "clause-not-selected", clause } };
  }
  const { mechanism } = selected;
  switch (entry.kind) {
    case "authorised-location": {
      const file = recordedFile({ file: entry.file });
      if (file.outcome === "failed") {
        return file;
      }
      return {
        outcome: "ok",
        value: { kind: entry.kind, clause, mechanism, file: file.value, reason: entry.reason },
      };
    }
    case "file-carve-out": {
      const file = recordedFile({ file: entry.file });
      if (file.outcome === "failed") {
        return file;
      }
      const whyChain = recordedWhyChain({ whyChain: entry.whyChain });
      if (whyChain.outcome === "failed") {
        return whyChain;
      }
      return {
        outcome: "ok",
        value: {
          kind: entry.kind,
          clause,
          mechanism,
          file: file.value,
          reason: entry.reason,
          whyChain: whyChain.value,
        },
      };
    }
    case "clause-wide-carve-out": {
      const whyChain = recordedWhyChain({ whyChain: entry.whyChain });
      if (whyChain.outcome === "failed") {
        return whyChain;
      }
      return {
        outcome: "ok",
        value: { kind: entry.kind, clause, mechanism, reason: entry.reason, whyChain: whyChain.value },
      };
    }
  }
};

type IdentityComparison = "same-identity" | "different-identity";

const identityComparison = (request: {
  readonly left: ExceptionRecord;
  readonly right: ExceptionRecord;
}): IdentityComparison => {
  const { left, right } = request;
  if (left.kind !== right.kind || sameClauseAddress({ left: left.clause, right: right.clause }) === "different") {
    return "different-identity";
  }
  switch (left.kind) {
    case "clause-wide-carve-out":
      return "same-identity";
    case "authorised-location":
    case "file-carve-out":
      return right.kind !== "clause-wide-carve-out" && left.file === right.file
        ? "same-identity"
        : "different-identity";
  }
};

export const parseExceptionEntries = (request: {
  readonly entries: ExceptionsFile["exceptions"];
  readonly selection: Selection;
}): {
  readonly records: readonly ExceptionRecord[];
  readonly invalid: readonly InvalidRecord[];
} => {
  const parsed = request.entries.map((entry, index) => ({
    index,
    record: parsedRecord({ entry, selection: request.selection }),
  }));
  const valid = parsed.flatMap(({ index, record }): readonly IndexedRecord[] =>
    record.outcome === "ok" ? [{ index, record: record.value }] : [],
  );
  const originalOf = (lookup: { readonly candidate: IndexedRecord }): IndexedRecord | undefined =>
    valid.find(
      (earlier) =>
        earlier.index < lookup.candidate.index &&
        identityComparison({ left: earlier.record, right: lookup.candidate.record }) ===
          "same-identity",
    );
  const problems = parsed.flatMap(({ index, record }): readonly InvalidRecord[] => {
    if (record.outcome === "failed") {
      return [{ index, problem: record.error }];
    }
    const original = originalOf({ candidate: { index, record: record.value } });
    return original === undefined ? [] : [{ index, problem: { kind: "duplicate", ofIndex: original.index } }];
  });
  return {
    records: valid
      .filter((candidate) => originalOf({ candidate }) === undefined)
      .map(({ record }) => record),
    invalid: problems,
  };
};

export const readExceptionEntries = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): Result<ExceptionsFile["exceptions"], LoadFailure> => {
  const path = request.path.join({ segments: [request.repoRoot, "discipline-exceptions.json"] });
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = exceptionsFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return {
      outcome: "failed",
      error: { kind: "file-malformed", path, detail: z.prettifyError(parsed.error) },
    };
  }
  return { outcome: "ok", value: parsed.data.exceptions };
};
