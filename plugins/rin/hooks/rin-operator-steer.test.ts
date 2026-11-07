import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import {
  runRanHookProcess,
  transcriptPayload,
  transcriptUserEntry,
} from "./run-hook-process.ts";
import { emittedAdvisoryFrom } from "./shared-core-bare.ts";

const hookPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "rin-operator-steer.ts",
);

const fixtureDirectories: string[] = [];

afterEach(() => {
  fixtureDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

const userEntry = (content: unknown, isMeta?: boolean) =>
  transcriptUserEntry({
    content,
    ...(isMeta === undefined ? {} : { isMeta }),
  });

const invokeAt = (input: {
  readonly transcriptPath: string;
  readonly cwd: string;
  readonly hookEventName?: string;
}) =>
  runRanHookProcess({
    hookFileName: "rin-operator-steer.ts",
    hookPath,
    runtime: "bun",
    stdinPayload: transcriptPayload({
      hookEventName: input.hookEventName ?? "PostToolUse",
      transcriptPath: input.transcriptPath,
      cwd: input.cwd,
    }),
  });

const invokeWithTranscript = async (input: {
  readonly lines: readonly string[];
  readonly hookEventName?: string;
}) => {
  const workingDirectory = mkdtempSync(join(tmpdir(), "rin-operator-steer-"));
  fixtureDirectories.push(workingDirectory);
  mkdirSync(join(workingDirectory, ".git"));
  const transcriptPath = join(workingDirectory, "transcript.jsonl");
  writeFileSync(transcriptPath, input.lines.join("\n"), "utf8");
  const outcome = await invokeAt({
    transcriptPath,
    cwd: workingDirectory,
    ...(input.hookEventName === undefined
      ? {}
      : { hookEventName: input.hookEventName }),
  });
  return { outcome, workingDirectory, transcriptPath };
};

describe("the operator-steer hook surfaces a pending steer", () => {
  test("a marked steer is surfaced as advisory context", async () => {
    const { outcome } = await invokeWithTranscript({
      lines: [userEntry("URGENT — stop and re-read the brief")],
    });

    expect(outcome.exitCode).toBe(0);
    const emitted = emittedAdvisoryFrom({ stdout: outcome.stdout });
    expect(emitted.state).toBe("advised");
    if (emitted.state !== "advised") return;
    expect(emitted.advisory.hookSpecificOutput.additionalContext).toContain(
      "URGENT — stop and re-read the brief",
    );
  });

  test("the advisory names the event it was raised on", async () => {
    const { outcome } = await invokeWithTranscript({
      lines: [userEntry("STEER: switch records")],
      hookEventName: "SubagentStop",
    });

    const emitted = emittedAdvisoryFrom({ stdout: outcome.stdout });
    expect(emitted.state).toBe("advised");
    if (emitted.state !== "advised") return;
    expect(emitted.advisory.hookSpecificOutput.hookEventName).toBe(
      "SubagentStop",
    );
  });

  test("an unmarked conversation surfaces nothing", async () => {
    const { outcome } = await invokeWithTranscript({
      lines: [userEntry("just a normal message")],
    });

    expect(outcome.exitCode).toBe(0);
    expect(emittedAdvisoryFrom({ stdout: outcome.stdout }).state).toBe(
      "silent",
    );
  });

  test("the same steer is surfaced once, not on every later boundary", async () => {
    const { outcome, transcriptPath, workingDirectory } =
      await invokeWithTranscript({
        lines: [userEntry("URGENT — only once please")],
      });
    expect(emittedAdvisoryFrom({ stdout: outcome.stdout }).state).toBe(
      "advised",
    );

    const second = await invokeAt({ transcriptPath, cwd: workingDirectory });

    expect(emittedAdvisoryFrom({ stdout: second.stdout }).state).toBe("silent");
  });

  // The two registered arms fire 3.2s apart around a seat's return (measured;
  // see the record's evidence/README.md). The ledger keys on the steer text
  // with no event component, so whichever arm reaches it first surfaces and
  // the other must go silent — otherwise every seat return double-surfaces.
  test("a steer surfaced on SubagentStop does not surface again on the PostToolUse that follows", async () => {
    const { outcome, transcriptPath, workingDirectory } =
      await invokeWithTranscript({
        lines: [userEntry("URGENT — cross-arm dedup")],
        hookEventName: "SubagentStop",
      });
    expect(emittedAdvisoryFrom({ stdout: outcome.stdout }).state).toBe(
      "advised",
    );

    const onResume = await invokeAt({
      transcriptPath,
      cwd: workingDirectory,
      hookEventName: "PostToolUse",
    });

    expect(emittedAdvisoryFrom({ stdout: onResume.stdout }).state).toBe(
      "silent",
    );
  });

  test("a second, different steer is surfaced after the first was seen", async () => {
    const { transcriptPath, workingDirectory, outcome } =
      await invokeWithTranscript({
        lines: [userEntry("URGENT — first")],
      });
    expect(emittedAdvisoryFrom({ stdout: outcome.stdout }).state).toBe(
      "advised",
    );

    writeFileSync(
      transcriptPath,
      [userEntry("URGENT — first"), userEntry("STEER: second")].join("\n"),
      "utf8",
    );
    const second = await invokeAt({ transcriptPath, cwd: workingDirectory });

    const emitted = emittedAdvisoryFrom({ stdout: second.stdout });
    expect(emitted.state).toBe("advised");
    if (emitted.state !== "advised") return;
    expect(emitted.advisory.hookSpecificOutput.additionalContext).toContain(
      "STEER: second",
    );
  });
});

describe("the hook never costs the operator a turn", () => {
  test("a missing transcript exits zero and says nothing", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: "rin-operator-steer.ts",
      hookPath,
      runtime: "bun",
      stdinPayload: transcriptPayload({
        hookEventName: "PostToolUse",
        transcriptPath: join(tmpdir(), "rin-operator-steer-absent.jsonl"),
      }),
    });

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout.trim()).toBe("");
  });

  test("a payload with no transcript path exits zero", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: "rin-operator-steer.ts",
      hookPath,
      runtime: "bun",
      stdinPayload: transcriptPayload({ hookEventName: "PostToolUse" }),
    });

    expect(outcome.exitCode).toBe(0);
  });

  test("unparseable stdin exits zero", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: "rin-operator-steer.ts",
      hookPath,
      runtime: "bun",
      stdinPayload: "not json",
    });

    expect(outcome.exitCode).toBe(0);
  });

  test("empty stdin exits zero", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: "rin-operator-steer.ts",
      hookPath,
      runtime: "bun",
      stdinPayload: "",
    });

    expect(outcome.exitCode).toBe(0);
  });
});
