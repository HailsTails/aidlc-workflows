import type { DisciplinesCheckOutcome } from "./rin-disciplines-check.ts";
import { type DisciplinesFinding, findingsOf } from "./rin-disciplines-report.ts";

type DisciplinesSensorWire = {
  readonly pass: boolean;
  readonly findings_count: number;
  readonly findings: readonly DisciplinesFinding[];
  readonly scanned: string;
  readonly writer_notice?: string;
};

const WRITER_NOTICE_FINDING_LIMIT = 10;

const RIN_WALKER_SCANNED_TEXT = "(constitution.engine is rin-walker: the cd-* sensors apply)";

const notEvaluatedWire: DisciplinesSensorWire = {
  pass: true,
  findings_count: 0,
  findings: [],
  scanned: RIN_WALKER_SCANNED_TEXT,
};

const unverifiedWireOf = ({ reason }: { readonly reason: string }): DisciplinesSensorWire => ({
  pass: false,
  findings_count: 0,
  findings: [],
  scanned: `(discipline-core reached no verdict: ${reason})`,
});

const findingNoticeLineOf = ({ finding }: { readonly finding: DisciplinesFinding }): string =>
  `${finding.clause} ${finding.file}:${String(finding.line)}:${String(finding.column)} ${finding.snippet}`;

const writerNoticeOf = ({ findings }: { readonly findings: readonly DisciplinesFinding[] }): string => {
  const listed = findings.slice(0, WRITER_NOTICE_FINDING_LIMIT).map((finding) => findingNoticeLineOf({ finding }));
  const remaining = findings.length - listed.length;
  return [...listed, ...(remaining > 0 ? [`… and ${String(remaining)} more discipline findings in this file`] : [])].join(
    "\n",
  );
};

const fileWireOf = ({
  findings,
  targetFile,
}: {
  readonly findings: readonly DisciplinesFinding[];
  readonly targetFile: string;
}): DisciplinesSensorWire => {
  const fileFindings = findings.filter((finding) => finding.file === targetFile);
  return {
    pass: fileFindings.length === 0,
    findings_count: fileFindings.length,
    findings: fileFindings,
    scanned: targetFile,
    ...(fileFindings.length === 0 ? {} : { writer_notice: writerNoticeOf({ findings: fileFindings }) }),
  };
};

const disciplinesSensorWireOf = ({
  outcome,
  targetFile,
}: {
  readonly outcome: DisciplinesCheckOutcome;
  readonly targetFile: string;
}): DisciplinesSensorWire => {
  switch (outcome.kind) {
    case "passed":
      return fileWireOf({ findings: [], targetFile });
    case "failed":
      return fileWireOf({ findings: findingsOf({ report: outcome.report }), targetFile });
    case "unverified":
      return unverifiedWireOf({ reason: outcome.reason });
  }
};

export type { DisciplinesSensorWire };
export { disciplinesSensorWireOf, notEvaluatedWire, unverifiedWireOf };
