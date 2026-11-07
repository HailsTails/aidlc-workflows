import { describe, expect, test, vi } from "vitest";
import {
  evaluateSolutionOptions,
  runSolutionOptions,
} from "./aidlc-sensor-solution-options.ts";
import type {
  SensorFileReader,
  TextRead,
} from "./rin-gates/rin-gates-sensor-report.ts";
import type { SensorRuntime } from "./rin-gates/rin-gates-sensor-runtime.ts";

const RECORD_DIRECTORY = "/repo/aidlc/spaces/default/intents/260101-rec";
const LEDGER_PATH = `${RECORD_DIRECTORY}/inception/rin-gate-2-plan-review/rin-solution-options.md`;
const QUESTIONS_PATH = `${RECORD_DIRECTORY}/inception/rin-gate-2-plan-review/rin-options-questions.md`;
const GATE_TWO_COMMAND_LINE_ARGUMENTS = [
  "--stage",
  "rin-gate-2-plan-review",
  "--output-path",
  QUESTIONS_PATH,
];
const INPUT_UNAVAILABLE_REMEDY =
  "The sensor could not read an input this gate needs, so it refuses rather than passes. Restore the named input and re-run the gate.";
const WRONG_GATE_REMEDY =
  "The sensor judges one gate only, so it refuses rather than passes elsewhere. Remove it from the invoking stage's sensors list, or run it at its own gate.";
const INCOMPLETE_INVOCATION_REMEDY =
  "The sensor was invoked without the flags it needs, so it refuses rather than passes. Invoke it with --stage and --output-path, as the engine does for a sensor a stage lists.";

const WELL_FORMED_READ: TextRead = {
  kind: "present",
  text: `## Point: storage
### Candidate A — Flat files
- **Premises:** GR-3
### Candidate B — SQLite
- **Premises:** none — local
- **Chosen:** B
- **Rejected A:** loses data
`,
};

describe("evaluateSolutionOptions", () => {
  test("passes a well-formed ledger at Gate 2, read from the record's fixed ledger path", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce(WELL_FORMED_READ);

    expect(
      evaluateSolutionOptions({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "clean",
      findings: [],
      scanned: "record 260101-rec at rin-gate-2-plan-review",
    });
    expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  });

  test("refuses a present ledger whose point has a single candidate, reporting the parsed ledger's findings", () => {
    const readText = vi.fn<SensorFileReader["readText"]>().mockReturnValueOnce({
      kind: "present",
      text: "## Point: storage\n### Candidate A — Flat files\n- **Premises:** GR-3\n- **Chosen:** A\n",
    });

    expect(
      evaluateSolutionOptions({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "refused",
      findings: [
        {
          check: "solution-options/ledger",
          artefact: "rin-solution-options.md",
          location: { kind: "line", lineNumber: 1 },
          subject: "Point storage has 1 distinct candidate(s)",
          remedy:
            "A decision point compares at least 2 genuinely different candidates; whether a third was needed is the board's judgement.",
        },
      ],
      scanned: "record 260101-rec at rin-gate-2-plan-review",
    });
    expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  });

  test("refuses at Gate 2 when the ledger is absent", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce({ kind: "absent" });

    expect(
      evaluateSolutionOptions({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "refused",
      findings: [
        {
          check: "solution-options/ledger",
          artefact: "rin-solution-options.md",
          location: { kind: "artefact" },
          subject: "rin-solution-options.md is absent",
          remedy:
            "Gate 2 writes the options ledger: its decision points, candidates, and the decision on each.",
        },
      ],
      scanned: "record 260101-rec at rin-gate-2-plan-review",
    });
    expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  });

  test("refuses as unmeasured when the ledger is unreadable", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce({ kind: "unreadable", reason: "EACCES" });

    expect(
      evaluateSolutionOptions({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "unmeasured",
      findings: [
        {
          check: "solution-options",
          artefact: "rin-solution-options.md",
          location: { kind: "artefact" },
          subject: "unmeasured: rin-solution-options.md is unreadable (EACCES)",
          remedy: INPUT_UNAVAILABLE_REMEDY,
        },
      ],
      scanned: "rin-solution-options.md",
    });
    expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  });

  test("refuses as unmeasured when invoked at a stage other than Gate 2, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateSolutionOptions({
        commandLineArguments: [
          "--stage",
          "rin-gate-3-interface-lock",
          "--output-path",
          LEDGER_PATH,
        ],
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "unmeasured",
      findings: [
        {
          check: "solution-options",
          artefact: "rin-solution-options.md",
          location: { kind: "artefact" },
          subject:
            "unmeasured: solution-options judges Gate 2 (rin-gate-2-plan-review) only, and was invoked at rin-gate-3-interface-lock",
          remedy: WRONG_GATE_REMEDY,
        },
      ],
      scanned: "rin-solution-options.md",
    });
    expect(readText.mock.calls).toEqual([]);
  });

  test("refuses as unmeasured when the dispatcher flags are missing, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateSolutionOptions({
        commandLineArguments: [],
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "unmeasured",
      findings: [
        {
          check: "solution-options",
          artefact: "rin-solution-options.md",
          location: { kind: "artefact" },
          subject: "unmeasured: missing --stage, --output-path",
          remedy: INCOMPLETE_INVOCATION_REMEDY,
        },
      ],
      scanned: "rin-solution-options.md",
    });
    expect(readText.mock.calls).toEqual([]);
  });

  test("passes an output outside any intent record, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateSolutionOptions({
        commandLineArguments: [
          "--stage",
          "rin-gate-2-plan-review",
          "--output-path",
          "/repo/docs/x.md",
        ],
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "clean",
      findings: [],
      scanned: "(not an intent record)",
    });
    expect(readText.mock.calls).toEqual([]);
  });
});

test("the solution-options adapter uses its runtime and writes one report", () => {
  const writeOutput = vi.fn<SensorRuntime["writeOutput"]>();
  const projectDirectory = vi
    .fn<SensorRuntime["projectDirectory"]>()
    .mockReturnValue("/repo");
  const readText = vi.fn<SensorFileReader["readText"]>().mockReturnValue({
    kind: "absent",
  });
  const runtime: SensorRuntime = {
    commandLineArguments: vi.fn(),
    projectDirectory,
    writeOutput,
  };

  runSolutionOptions({
    commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
    fileReader: { readText },
    runtime,
  });

  expect(projectDirectory).toHaveBeenCalledOnce();
  expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  expect(writeOutput).toHaveBeenCalledExactlyOnceWith({
    text: '{"pass":false,"sensor":"solution-options","verdict":"refused","findings_count":1,"findings":[{"check":"solution-options/ledger","artefact":"rin-solution-options.md","location":{"kind":"artefact"},"subject":"rin-solution-options.md is absent","remedy":"Gate 2 writes the options ledger: its decision points, candidates, and the decision on each."}],"scanned":"record 260101-rec at rin-gate-2-plan-review"}\n',
  });
});
