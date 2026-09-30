import { describe, expect, test, vi } from "vitest";
import {
  evaluateFramingOnly,
  runFramingOnly,
} from "./aidlc-sensor-framing-only.ts";
import type { SensorFileReader } from "./rin-gates/rin-gates-sensor-report.ts";
import type { SensorRuntime } from "./rin-gates/rin-gates-sensor-runtime.ts";

const LEDGER_PATH =
  "/repo/aidlc/spaces/default/intents/260101-rec/inception/rin-gate-2-plan-review/rin-solution-options.md";
const GATE_TWO_COMMAND_LINE_ARGUMENTS = [
  "--stage",
  "rin-gate-2-plan-review",
  "--output-path",
  LEDGER_PATH,
];
const INPUT_UNAVAILABLE_REMEDY =
  "The sensor could not read an input this gate needs, so it refuses rather than passes. Restore the named input and re-run the gate.";
const WRONG_GATE_REMEDY =
  "The sensor judges one gate only, so it refuses rather than passes elsewhere. Remove it from the invoking stage's sensors list, or run it at its own gate.";
const INCOMPLETE_INVOCATION_REMEDY =
  "The sensor was invoked without the flags it needs, so it refuses rather than passes. Invoke it with --stage and --output-path, as the engine does for a sensor a stage lists.";

describe("evaluateFramingOnly", () => {
  test("refuses a programming-language fence at Gate 2", () => {
    const readText = vi.fn<SensorFileReader["readText"]>().mockReturnValueOnce({
      kind: "present",
      text: "```ts\nconst x = 1;\n```\n",
    });

    expect(
      evaluateFramingOnly({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "refused",
      findings: [
        {
          check: "framing-only/programming-language-fence",
          artefact: "rin-solution-options.md",
          location: { kind: "line", lineNumber: 1 },
          subject: "a `ts` code fence",
          remedy:
            "Gate 2 is prose and diagrams: describe the shape in prose or mermaid, and quote existing code as evidence in a `text` fence. Signatures and code belong to Gate 3.",
        },
      ],
      scanned: "rin-solution-options.md at rin-gate-2-plan-review",
    });
    expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  });

  test("passes a Gate-2 artefact carrying only prose, diagrams and evidence", () => {
    const readText = vi.fn<SensorFileReader["readText"]>().mockReturnValueOnce({
      kind: "present",
      text: "Prose.\n\n```mermaid\ngraph TD\n```\n```bash\nls\n```\n",
    });

    expect(
      evaluateFramingOnly({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "clean",
      findings: [],
      scanned: "rin-solution-options.md at rin-gate-2-plan-review",
    });
    expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  });

  test("refuses as unmeasured when invoked at a stage other than Gate 2, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateFramingOnly({
        commandLineArguments: [
          "--stage",
          "rin-gate-1-framing",
          "--output-path",
          LEDGER_PATH,
        ],
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "unmeasured",
      findings: [
        {
          check: "framing-only",
          artefact: "rin-solution-options.md",
          location: { kind: "artefact" },
          subject:
            "unmeasured: framing-only judges Gate 2 (rin-gate-2-plan-review) only, and was invoked at rin-gate-1-framing",
          remedy: WRONG_GATE_REMEDY,
        },
      ],
      scanned: "rin-solution-options.md",
    });
    expect(readText.mock.calls).toEqual([]);
  });

  test("refuses as unmeasured when the artefact is unreadable", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce({ kind: "unreadable", reason: "EACCES" });

    expect(
      evaluateFramingOnly({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "unmeasured",
      findings: [
        {
          check: "framing-only",
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

  test("refuses as unmeasured when the artefact is absent", () => {
    const readText = vi
      .fn<SensorFileReader["readText"]>()
      .mockReturnValueOnce({ kind: "absent" });

    expect(
      evaluateFramingOnly({
        commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "unmeasured",
      findings: [
        {
          check: "framing-only",
          artefact: "rin-solution-options.md",
          location: { kind: "artefact" },
          subject: "unmeasured: rin-solution-options.md is absent",
          remedy: INPUT_UNAVAILABLE_REMEDY,
        },
      ],
      scanned: "rin-solution-options.md",
    });
    expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
  });

  test("refuses as unmeasured when the dispatcher flags are missing, reading nothing", () => {
    const readText = vi.fn<SensorFileReader["readText"]>();

    expect(
      evaluateFramingOnly({
        commandLineArguments: ["--stage", "rin-gate-2-plan-review"],
        fileReader: { readText },
      }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "unmeasured",
      findings: [
        {
          check: "framing-only",
          artefact: "(none)",
          location: { kind: "artefact" },
          subject: "unmeasured: missing --output-path",
          remedy: INCOMPLETE_INVOCATION_REMEDY,
        },
      ],
      scanned: "(none)",
    });
    expect(readText.mock.calls).toEqual([]);
  });
});

test("the framing-only adapter writes the evaluated report through its runtime", () => {
  const writeOutput = vi.fn<SensorRuntime["writeOutput"]>();
  const readText = vi.fn<SensorFileReader["readText"]>().mockReturnValue({
    kind: "present",
    text: "Framing evidence.\n",
  });
  const runtime: SensorRuntime = {
    commandLineArguments: vi.fn(),
    projectDirectory: vi.fn(),
    writeOutput,
  };

  runFramingOnly({
    commandLineArguments: GATE_TWO_COMMAND_LINE_ARGUMENTS,
    fileReader: { readText },
    runtime,
  });

  expect(writeOutput).toHaveBeenCalledExactlyOnceWith({
    text: '{"pass":true,"sensor":"framing-only","verdict":"clean","findings_count":0,"findings":[],"scanned":"rin-solution-options.md at rin-gate-2-plan-review"}\n',
  });
  expect(readText.mock.calls).toEqual([[{ path: LEDGER_PATH }]]);
});
