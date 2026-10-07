import { describe, expect, test, vi } from "vitest";
import {
  evaluateMeasuredContracts,
  runMeasuredContracts,
} from "./aidlc-sensor-measured-contracts.ts";
import type {
  SensorFileReader,
  TextRead,
} from "./rin-gates/rin-gates-sensor-report.ts";
import type { SensorRuntime } from "./rin-gates/rin-gates-sensor-runtime.ts";

const RECORD_DIRECTORY = "/repo/aidlc/spaces/default/intents/260101-rec";
const LOCK_PATH = `${RECORD_DIRECTORY}/inception/rin-gate-3-interface-lock/rin-interface-lock.md`;
const LEDGER_PATH = `${RECORD_DIRECTORY}/inception/rin-gate-2-plan-review/rin-solution-options.md`;
const FACTS_PATH = `${RECORD_DIRECTORY}/facts.md`;
const GATE_THREE_COMMAND_LINE_ARGUMENTS = [
  "--stage",
  "rin-gate-3-interface-lock",
  "--output-path",
  LOCK_PATH,
];
const INPUT_UNAVAILABLE_REMEDY =
  "The sensor could not read an input this gate needs, so it refuses rather than passes. Restore the named input and re-run the gate.";
const WRONG_GATE_REMEDY =
  "The sensor judges one gate only, so it refuses rather than passes elsewhere. Remove it from the invoking stage's sensors list, or run it at its own gate.";
const INCOMPLETE_INVOCATION_REMEDY =
  "The sensor was invoked without the flags it needs, so it refuses rather than passes. Invoke it with --stage and --output-path, as the engine does for a sensor a stage lists.";

const LEDGER_READ: TextRead = {
  kind: "present",
  text: `## Point: storage
### Candidate A — Remote
- **Premises:** TR-1
### Candidate B — Local
- **Premises:** none — local
- **Chosen:** A
- **Rejected B:** no sharing
`,
};

const LOCK_READ: TextRead = {
  kind: "present",
  text: "## External reality\n\n- TR-1 — holds\n",
};

const factsReadWith = ({ status }: { readonly status: string }): TextRead => ({
  kind: "present",
  text: `| key | claim | value | status |\n|---|---|---|---|\n| TR-1 | pages | 100 | ${status} |\n`,
});

test("the measured-contracts adapter takes the project directory from its runtime", () => {
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

  runMeasuredContracts({
    commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
    fileReader: { readText },
    runtime,
  });

  expect(projectDirectory).toHaveBeenCalledOnce();
  expect(readText.mock.calls).toEqual([[{ path: LOCK_PATH }]]);
  expect(writeOutput).toHaveBeenCalledExactlyOnceWith({
    text: '{"pass":false,"sensor":"measured-contracts","verdict":"unmeasured","findings_count":1,"findings":[{"check":"measured-contracts","artefact":"rin-interface-lock.md","location":{"kind":"artefact"},"subject":"unmeasured: rin-interface-lock.md is absent","remedy":"The sensor could not read an input this gate needs, so it refuses rather than passes. Restore the named input and re-run the gate."}],"scanned":"rin-interface-lock.md"}\n',
  });
});

describe("evaluateMeasuredContracts", () => {
  test("passes a lock whose chosen premise is listed and live, reading the lock, the ledger and facts.md in turn", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce(LOCK_READ)
      .mockReturnValueOnce(LEDGER_READ)
      .mockReturnValueOnce(factsReadWith({ status: "live" }));

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "clean",
      findings: [],
      scanned: "rin-interface-lock.md of record 260101-rec",
    });
    expect(readText.mock.calls).toEqual([
      [{ path: LOCK_PATH }],
      [{ path: LEDGER_PATH }],
      [{ path: FACTS_PATH }],
    ]);
  });

  test("refuses a lock whose chosen premise is still unmeasured", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce(LOCK_READ)
      .mockReturnValueOnce(LEDGER_READ)
      .mockReturnValueOnce(factsReadWith({ status: "unmeasured" }));

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "refused",
      findings: [
        {
          check: "measured-contracts/chosen-premise",
          artefact: "facts.md",
          location: { kind: "artefact" },
          subject: 'chosen premise TR-1 has status "unmeasured" at line 3',
          remedy:
            "Measure TR-1: its status becomes exactly live or corrected. A failed premise routes back to Gate 2 by the backward jump.",
        },
      ],
      scanned: "rin-interface-lock.md of record 260101-rec",
    });
    expect(readText.mock.calls).toEqual([
      [{ path: LOCK_PATH }],
      [{ path: LEDGER_PATH }],
      [{ path: FACTS_PATH }],
    ]);
  });

  test("passes a record with no options ledger, says the board judges its premises, and never reads facts.md", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce(LOCK_READ)
      .mockReturnValueOnce({ kind: "absent" });

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "clean",
      findings: [],
      scanned:
        "rin-interface-lock.md of record 260101-rec: no Gate-2 rin-solution-options.md, so the premises the design rests on are the board's to judge",
    });
    expect(readText.mock.calls).toEqual([
      [{ path: LOCK_PATH }],
      [{ path: LEDGER_PATH }],
    ]);
  });

  test("refuses as unmeasured when facts.md is unreadable", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce(LOCK_READ)
      .mockReturnValueOnce(LEDGER_READ)
      .mockReturnValueOnce({ kind: "unreadable", reason: "EISDIR" });

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "unmeasured",
      findings: [
        {
          check: "measured-contracts",
          artefact: "rin-interface-lock.md",
          location: { kind: "artefact" },
          subject: "unmeasured: facts.md is unreadable (EISDIR)",
          remedy: INPUT_UNAVAILABLE_REMEDY,
        },
      ],
      scanned: "rin-interface-lock.md",
    });
    expect(readText.mock.calls).toEqual([
      [{ path: LOCK_PATH }],
      [{ path: LEDGER_PATH }],
      [{ path: FACTS_PATH }],
    ]);
  });

  test("refuses as unmeasured when the options ledger is unreadable", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce(LOCK_READ)
      .mockReturnValueOnce({ kind: "unreadable", reason: "EACCES" });

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "unmeasured",
      findings: [
        {
          check: "measured-contracts",
          artefact: "rin-interface-lock.md",
          location: { kind: "artefact" },
          subject: "unmeasured: rin-solution-options.md is unreadable (EACCES)",
          remedy: INPUT_UNAVAILABLE_REMEDY,
        },
      ],
      scanned: "rin-interface-lock.md",
    });
    expect(readText.mock.calls).toEqual([
      [{ path: LOCK_PATH }],
      [{ path: LEDGER_PATH }],
    ]);
  });

  test("refuses as unmeasured when the lock is absent", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce({ kind: "absent" });

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "unmeasured",
      findings: [
        {
          check: "measured-contracts",
          artefact: "rin-interface-lock.md",
          location: { kind: "artefact" },
          subject: "unmeasured: rin-interface-lock.md is absent",
          remedy: INPUT_UNAVAILABLE_REMEDY,
        },
      ],
      scanned: "rin-interface-lock.md",
    });
    expect(readText.mock.calls).toEqual([[{ path: LOCK_PATH }]]);
  });

  test("refuses as unmeasured when the lock is unreadable", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce({ kind: "unreadable", reason: "EACCES" });

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: GATE_THREE_COMMAND_LINE_ARGUMENTS,
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "unmeasured",
      findings: [
        {
          check: "measured-contracts",
          artefact: "rin-interface-lock.md",
          location: { kind: "artefact" },
          subject: "unmeasured: rin-interface-lock.md is unreadable (EACCES)",
          remedy: INPUT_UNAVAILABLE_REMEDY,
        },
      ],
      scanned: "rin-interface-lock.md",
    });
    expect(readText.mock.calls).toEqual([[{ path: LOCK_PATH }]]);
  });

  test("refuses as unmeasured when invoked at a stage other than Gate 3, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: [
          "--stage",
          "rin-gate-2-plan-review",
          "--output-path",
          LOCK_PATH,
        ],
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "unmeasured",
      findings: [
        {
          check: "measured-contracts",
          artefact: "rin-interface-lock.md",
          location: { kind: "artefact" },
          subject:
            "unmeasured: measured-contracts judges Gate 3 (rin-gate-3-interface-lock) only, and was invoked at rin-gate-2-plan-review",
          remedy: WRONG_GATE_REMEDY,
        },
      ],
      scanned: "rin-interface-lock.md",
    });
    expect(readText.mock.calls).toEqual([]);
  });

  test("refuses as unmeasured when the dispatcher flags are missing, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: ["--stage", "rin-gate-3-interface-lock"],
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "unmeasured",
      findings: [
        {
          check: "measured-contracts",
          artefact: "rin-interface-lock.md",
          location: { kind: "artefact" },
          subject: "unmeasured: missing --output-path",
          remedy: INCOMPLETE_INVOCATION_REMEDY,
        },
      ],
      scanned: "rin-interface-lock.md",
    });
    expect(readText.mock.calls).toEqual([]);
  });

  test("passes a lock outside any intent record, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateMeasuredContracts({
        commandLineArguments: [
          "--stage",
          "rin-gate-3-interface-lock",
          "--output-path",
          "/repo/docs/rin-interface-lock.md",
        ],
        projectDirectory: "/repo",
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "measured-contracts",
      verdict: "clean",
      findings: [],
      scanned: "(not an intent record)",
    });
    expect(readText.mock.calls).toEqual([]);
  });
});
