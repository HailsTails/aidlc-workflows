import {
  closedTokenOf,
  type MarkdownLine,
  markdownLinesOf,
  statedTokenOf,
} from "./rin-gates-markdown-lines.ts";
import type { SensorDocument } from "./rin-gates-sensor-report.ts";

type FactStatus = "live" | "corrected" | "withdrawn" | "unmeasured";

type FactStatusCell =
  | { readonly kind: "stated"; readonly status: FactStatus }
  | { readonly kind: "malformed"; readonly text: string };

type FactRow = {
  readonly key: string;
  readonly claim: string;
  readonly statusCell: FactStatusCell;
  readonly lineNumber: number;
};

type TableContext =
  | {
      readonly kind: "facts-table";
      readonly claimColumn: number;
      readonly statusColumn: number;
    }
  | { readonly kind: "not-facts-table" };

type RowScan = {
  readonly context: TableContext;
  readonly rows: readonly FactRow[];
};

const FACT_KEY = /^[A-Z]+-\d+$/;
const CELL_SEPARATOR = /(?<!\\)\|/;
const DELIMITER_ROW = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?$/;
const NOT_A_FACTS_TABLE: TableContext = { kind: "not-facts-table" };
const FACT_STATUSES: readonly FactStatus[] = [
  "live",
  "corrected",
  "withdrawn",
  "unmeasured",
];

const factKeyOf = ({
  token,
}: {
  readonly token: string;
}): string | undefined => {
  const strippedToken = statedTokenOf({ text: token });
  return FACT_KEY.test(strippedToken) ? strippedToken : undefined;
};

const factStatusOf = ({ cell }: { readonly cell: string }): FactStatusCell => {
  const status = closedTokenOf({ text: cell, tokens: FACT_STATUSES });
  if (status === undefined) {
    return { kind: "malformed", text: cell.trim() };
  }
  return { kind: "stated", status };
};

const cellsOf = ({ text }: { readonly text: string }): readonly string[] =>
  text
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(CELL_SEPARATOR)
    .map((cell) => cell.trim());

const headerContext = ({
  cells,
}: {
  readonly cells: readonly string[];
}): TableContext => {
  const lowercaseHeaders = cells.map((cell) => cell.toLowerCase());
  const claimColumn = lowercaseHeaders.indexOf("claim");
  const statusColumn = lowercaseHeaders.indexOf("status");
  if (
    lowercaseHeaders[0] !== "key" ||
    claimColumn === -1 ||
    statusColumn === -1
  ) {
    return NOT_A_FACTS_TABLE;
  }
  return { kind: "facts-table", claimColumn, statusColumn };
};

const scanTableLine = ({
  scan,
  markdownLine,
}: {
  readonly scan: RowScan;
  readonly markdownLine: MarkdownLine;
}): RowScan => {
  if (DELIMITER_ROW.test(markdownLine.text.trim())) {
    return scan;
  }
  const cells = cellsOf({ text: markdownLine.text });
  const key = factKeyOf({ token: cells[0] ?? "" });
  if (key === undefined) {
    const candidateContext = headerContext({ cells });
    return candidateContext.kind === "facts-table"
      ? { context: candidateContext, rows: scan.rows }
      : scan;
  }
  if (scan.context.kind === "not-facts-table") {
    return scan;
  }
  return {
    context: scan.context,
    rows: [
      ...scan.rows,
      {
        key,
        claim: cells[scan.context.claimColumn] ?? "",
        statusCell: factStatusOf({
          cell: cells[scan.context.statusColumn] ?? "",
        }),
        lineNumber: markdownLine.lineNumber,
      },
    ],
  };
};

const factRowsFrom = ({
  markdownText,
}: {
  readonly markdownText: string;
}): readonly FactRow[] =>
  markdownLinesOf({ markdownText }).reduce<RowScan>(
    (scan, markdownLine) =>
      markdownLine.region.kind === "prose" &&
      markdownLine.text.trim().startsWith("|")
        ? scanTableLine({ scan, markdownLine })
        : { context: NOT_A_FACTS_TABLE, rows: scan.rows },
    { context: NOT_A_FACTS_TABLE, rows: [] },
  ).rows;

const factRowsOfDocument = ({
  factsDocument,
}: {
  readonly factsDocument: SensorDocument;
}): readonly FactRow[] => {
  if (factsDocument.kind === "absent") {
    return [];
  }
  return factRowsFrom({ markdownText: factsDocument.text });
};

export {
  type FactRow,
  type FactStatus,
  type FactStatusCell,
  factKeyOf,
  factRowsFrom,
  factRowsOfDocument,
  factStatusOf,
};
