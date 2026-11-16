import { describe, expect, test } from "vitest";
import type { ReplayResult } from "./review-history-replay.ts";
import {
  type ReplayCommand,
  replayRequestOf,
  runReplay,
  scribeInstallationUnder,
} from "./review-history-replay-cli.ts";
import type { ScribeInstallation } from "./review-history-replay-gate.ts";

const INSTALLATION: ScribeInstallation = {
  scribe: "/repo/.claude/hooks/rin-gates-review-scribe.ts",
  rosterConfig: "/repo/.claude/hooks/review-rosters.json",
  stageGraph: "/repo/.claude/tools/data/stage-graph.json",
  harnessConfig: "/repo/harness.config.json",
};

const LEFT_OPEN: ReplayResult = {
  kind: "left-open",
  verdict: "NOT-READY",
  headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  lensReports: 6,
};

const COMPLETE_ARGUMENTS: readonly string[] = [
  "--history",
  "histories/260101-close.rin-gate-1-framing.json",
  "--bounded-close",
  "this-record",
  "--forward-gate",
  "rin-gate-2-plan-review",
];

type RecordedCommand = {
  readonly command: Omit<ReplayCommand, "args">;
  readonly published: string[];
  readonly diagnosed: string[];
  readonly replayed: unknown[];
};

const recordedCommand = (): RecordedCommand => {
  const published: string[] = [];
  const diagnosed: string[] = [];
  const replayed: unknown[] = [];
  return {
    published,
    diagnosed,
    replayed,
    command: {
      installation: INSTALLATION,
      replay: (request) => {
        replayed.push(request);
        return Promise.resolve(LEFT_OPEN);
      },
      publish: (text) => {
        published.push(text);
      },
      diagnose: (text) => {
        diagnosed.push(text);
      },
    },
  };
};

describe("the replay command reads which history to replay and how from its flags", () => {
  test("all three flags name the history, the flag setting and the gate a forward goes to", () => {
    expect(replayRequestOf({ args: COMPLETE_ARGUMENTS })).toEqual({
      historyPath: "histories/260101-close.rin-gate-1-framing.json",
      boundedClose: "this-record",
      forwardGate: "rin-gate-2-plan-review",
    });
  });

  test("a missing history is no request", () => {
    expect(
      replayRequestOf({
        args: [
          "--bounded-close",
          "off",
          "--forward-gate",
          "rin-gate-2-plan-review",
        ],
      }),
    ).toBeNull();
  });

  test("a flag setting other than off or this-record is no request", () => {
    expect(
      replayRequestOf({
        args: [
          "--history",
          "histories/260101-close.rin-gate-1-framing.json",
          "--bounded-close",
          "all",
          "--forward-gate",
          "rin-gate-2-plan-review",
        ],
      }),
    ).toBeNull();
  });
});

describe("the replay runs against the scribe installed beside the command", () => {
  test("the scribe, its roster and the stage graph are read from the harness directory and the flag from the repository", () => {
    expect(
      scribeInstallationUnder({
        harnessDirectory: "/repo/.claude",
        repository: "/repo",
        join: (...segments) => segments.join("/"),
      }),
    ).toEqual(INSTALLATION);
  });
});

describe("the replay command prints what the replay found", () => {
  test("a complete request is replayed against the installation and its result published", async () => {
    const recorded = recordedCommand();
    const status = await runReplay({
      ...recorded.command,
      args: COMPLETE_ARGUMENTS,
    });
    expect(status).toBe(0);
    expect(recorded.replayed).toEqual([
      {
        historyPath: "histories/260101-close.rin-gate-1-framing.json",
        boundedClose: "this-record",
        forwardGate: "rin-gate-2-plan-review",
        installation: INSTALLATION,
      },
    ]);
    expect(recorded.published).toEqual([
      '{\n  "kind": "left-open",\n  "verdict": "NOT-READY",\n  "headSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",\n  "lensReports": 6\n}\n',
    ]);
  });

  test("an incomplete request replays nothing and prints the usage", async () => {
    const recorded = recordedCommand();
    const status = await runReplay({ ...recorded.command, args: [] });
    expect(status).toBe(1);
    expect(recorded.replayed).toEqual([]);
    expect(recorded.diagnosed).toEqual([
      "usage: review-history-replay-cli --history <review history json> --bounded-close <off|this-record> --forward-gate <later gate>\n",
    ]);
  });
});
