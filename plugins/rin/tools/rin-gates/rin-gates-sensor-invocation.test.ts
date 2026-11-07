import { describe, expect, test } from "vitest";
import {
  recordLocationFor,
  sensorInvocationFrom,
} from "./rin-gates-sensor-invocation.ts";

describe("sensorInvocationFrom", () => {
  test("reads the stage and output path the dispatcher passes", () => {
    expect(
      sensorInvocationFrom({
        commandLineArguments: [
          "--stage",
          "rin-gate-2-plan-review",
          "--output-path",
          "a/b.md",
        ],
      }),
    ).toEqual({
      kind: "invoked",
      stage: "rin-gate-2-plan-review",
      outputPath: "a/b.md",
    });
  });

  test("names every missing flag, including one followed by another flag", () => {
    expect(
      sensorInvocationFrom({
        commandLineArguments: ["--stage", "--output-path"],
      }),
    ).toEqual({
      kind: "incomplete",
      missingFlags: ["--stage", "--output-path"],
    });
  });
});

describe("recordLocationFor", () => {
  test("derives the record and its space from an absolute Windows output path", () => {
    expect(
      recordLocationFor({
        outputPath:
          "H:\\repo\\aidlc\\spaces\\teamb\\intents\\260101-rec\\inception\\rin-gate-2-plan-review\\rin-solution-options.md",
        projectDirectory: "H:\\repo",
      }),
    ).toEqual({
      kind: "record",
      recordDirectory: "H:/repo/aidlc/spaces/teamb/intents/260101-rec",
      recordName: "260101-rec",
    });
  });

  test("resolves a relative output path against the project directory", () => {
    expect(
      recordLocationFor({
        outputPath: "./aidlc/spaces/default/intents/260101-rec/facts.md",
        projectDirectory: "/work/repo/",
      }),
    ).toEqual({
      kind: "record",
      recordDirectory: "/work/repo/aidlc/spaces/default/intents/260101-rec",
      recordName: "260101-rec",
    });
  });

  test("takes the record store's own intents directory when the checkout path holds an earlier intents segment", () => {
    expect(
      recordLocationFor({
        outputPath:
          "/home/operator/intents/rin/aidlc/spaces/default/intents/260101-rec/inception/rin-gate-3-interface-lock/rin-interface-lock.md",
        projectDirectory: "/home/operator/intents/rin",
      }),
    ).toEqual({
      kind: "record",
      recordDirectory:
        "/home/operator/intents/rin/aidlc/spaces/default/intents/260101-rec",
      recordName: "260101-rec",
    });
  });

  test("takes the last record-store segment when the path holds two", () => {
    expect(
      recordLocationFor({
        outputPath:
          "/work/aidlc/spaces/default/intents/outer-rec/nested/aidlc/spaces/default/intents/inner-rec/facts.md",
        projectDirectory: "/work",
      }),
    ).toEqual({
      kind: "record",
      recordDirectory:
        "/work/aidlc/spaces/default/intents/outer-rec/nested/aidlc/spaces/default/intents/inner-rec",
      recordName: "inner-rec",
    });
  });

  test("reports an intents directory outside the record store as no record", () => {
    expect(
      recordLocationFor({
        outputPath: "/work/intents/notes/rin-interface-lock.md",
        projectDirectory: "/work",
      }),
    ).toEqual({
      kind: "not-a-record",
    });
  });

  test("reports a path outside any intent record", () => {
    expect(
      recordLocationFor({
        outputPath: "/work/repo/docs/x.md",
        projectDirectory: "/work/repo",
      }),
    ).toEqual({
      kind: "not-a-record",
    });
  });

  test("reports the intents directory itself as no record", () => {
    expect(
      recordLocationFor({
        outputPath: "/work/repo/aidlc/spaces/default/intents/",
        projectDirectory: "/work/repo",
      }),
    ).toEqual({
      kind: "not-a-record",
    });
  });
});
