type DisciplinesReportSection = {
  readonly name: string;
  readonly header: string;
  readonly lines: readonly string[];
};

type FailingSectionName =
  | "findings"
  | "uncovered"
  | "stale"
  | "forfeited"
  | "unrecorded"
  | "doublyHeld"
  | "invalidRecords"
  | "unmeasured"
  | "projectionProblems";

type FailingSection = DisciplinesReportSection & {
  readonly name: FailingSectionName;
};

type DisciplinesFinding = {
  readonly clause: string;
  readonly mechanism: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
};

type ReplacedPackage = {
  readonly name: string;
  readonly migratingSection: number;
  readonly checkCommand: string;
};

const HONE_PACKAGE = "@hailstails/hone";

const PACKAGED_HONE_INSTALL = `node_modules/${HONE_PACKAGE}`;

const REPLACED_PACKAGES: readonly ReplacedPackage[] = [
  { name: "discipline-core", migratingSection: 10, checkCommand: "check-command.js" },
  { name: "honed", migratingSection: 11, checkCommand: "tool-command.js" },
];

const VENDORED_CORE_INSTALL = "tools/discipline-core";

const HONE_MIGRATING_URL = "https://github.com/HailsTails/hone/blob/v1.1.0/MIGRATING.md";

const CHECK_COMMAND_TEXT = "npm run --silent hone:check";

const PROJECT_COMMAND_TEXT = "npm run --silent hone:project";

const SECTION_HEADER = /^([A-Za-z]+) \(\d+\)$/;

const VERDICT_LINE_PREFIX = "verdict: ";

const FINDING_LINE = /^(\S+) (\S+) (.+?):(\d+):(\d+)(?: (.*))?$/;

const SECTION_REMEDIES: Readonly<Record<FailingSectionName, string>> = {
  findings:
    `change the code, or record an exception in discipline-exceptions.json, or in the discipline's file under discipline-exceptions/ in Hone's split layout, with a whyChain written to ${PACKAGED_HONE_INSTALL}/docs/why-chain-contract.md: five whys chained cause to cause, a rootCause, its rootCheck, a readback and an owner.`,
  uncovered:
    "select every mechanical clause of each adopted discipline in disciplines.json.",
  stale:
    "delete those records from discipline-exceptions.json, or from their discipline's file under discipline-exceptions/, since they exempt nothing.",
  forfeited:
    "the carved-out file was touched, so make the whole file comply and delete its carve-out (CD-46).",
  unrecorded:
    "remove the ignore, suppression, inline disable, config override or command-line option that weakens a selected rule, or record it as an exception.",
  doublyHeld: "keep one exception record per clause and file.",
  invalidRecords: "correct the named entries in discipline-exceptions.json, or in the discipline-exceptions/ file each line names.",
  unmeasured:
    "set constitution.baseRevision in harness.config.json, or project the mechanism it names with the project command and commit the projection.",
  projectionProblems: `run \`${PROJECT_COMMAND_TEXT}\` and commit disciplines.eslint.mjs.`,
};

const isFailingSection = (
  section: DisciplinesReportSection,
): section is FailingSection => Object.hasOwn(SECTION_REMEDIES, section.name);

const reportLinesOf = ({
  report,
}: {
  readonly report: string;
}): readonly string[] =>
  report
    .split(/\r?\n/)
    .filter((line) => line.length > 0 && !line.startsWith(VERDICT_LINE_PREFIX));

const disciplinesReportSectionsOf = ({
  report,
}: {
  readonly report: string;
}): readonly DisciplinesReportSection[] => {
  const lines = reportLinesOf({ report });
  const headerIndexes = lines.flatMap((line, lineIndex) =>
    SECTION_HEADER.test(line) ? [lineIndex] : [],
  );
  return headerIndexes.map((headerIndex, position) => {
    const header = lines[headerIndex] ?? "";
    return {
      name: SECTION_HEADER.exec(header)?.[1] ?? "",
      header,
      lines: lines.slice(headerIndex + 1, headerIndexes[position + 1] ?? lines.length),
    };
  });
};

const failingSectionsOf = ({
  report,
}: {
  readonly report: string;
}): readonly FailingSection[] =>
  disciplinesReportSectionsOf({ report }).filter(isFailingSection);

const remedyOf = ({ section }: { readonly section: FailingSection }): string =>
  `To fix ${section.name}: ${SECTION_REMEDIES[section.name]}`;

const findingOf = ({
  line,
}: {
  readonly line: string;
}): readonly DisciplinesFinding[] => {
  const matched = FINDING_LINE.exec(line);
  if (matched === null) {
    return [];
  }
  const [, clause, mechanism, file, lineText, columnText, snippet] = matched;
  if (
    clause === undefined ||
    mechanism === undefined ||
    file === undefined ||
    lineText === undefined ||
    columnText === undefined
  ) {
    return [];
  }
  return [
    {
      clause,
      mechanism,
      file,
      line: Number(lineText),
      column: Number(columnText),
      snippet: snippet ?? "",
    },
  ];
};

const findingsOf = ({
  report,
}: {
  readonly report: string;
}): readonly DisciplinesFinding[] =>
  disciplinesReportSectionsOf({ report })
    .filter((section) => section.name === "findings")
    .flatMap((section) => section.lines.flatMap((line) => findingOf({ line })));

export type {
  DisciplinesFinding,
  DisciplinesReportSection,
  FailingSection,
  FailingSectionName,
  ReplacedPackage,
};
export {
  CHECK_COMMAND_TEXT,
  disciplinesReportSectionsOf,
  failingSectionsOf,
  findingsOf,
  HONE_MIGRATING_URL,
  HONE_PACKAGE,
  PACKAGED_HONE_INSTALL,
  remedyOf,
  REPLACED_PACKAGES,
  VENDORED_CORE_INSTALL,
};
