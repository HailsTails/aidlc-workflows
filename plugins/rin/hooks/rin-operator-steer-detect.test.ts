import { describe, expect, test } from "vitest";
import {
  ACKNOWLEDGEMENT_OPENING,
  acknowledgementDirective,
  alreadySurfaced,
  carriesSteerMarker,
  fingerprintOf,
  humanTurnsIn,
  pendingSteerIn,
  recordSurfaced,
  type SteerLedger,
} from "./rin-operator-steer-detect.ts";

const userEntry = (content: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "user",
    message: { role: "user", content },
    ...extra,
  });

const assistantEntry = (text: string) =>
  JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
  });

const transcriptOf = (...lines: readonly string[]) => lines.join("\n");

describe("marker recognition accepts the convention and nothing else", () => {
  test.each([
    ["URGENT — stop rebasing", "em-dash urgent"],
    ["URGENT - stop rebasing", "hyphen urgent"],
    ["STEER: switch to the other record", "steer prefix"],
    ["   STEER: leading whitespace is trimmed", "leading whitespace"],
  ])("%s is a steer (%s)", (text: string) => {
    expect(carriesSteerMarker(text)).toBe(true);
  });

  test.each([
    ["please stop rebasing", "unmarked prose"],
    ["that was urgent — but unmarked", "marker not leading"],
    ["A note mentioning STEER: mid-sentence", "marker not leading"],
    ["", "empty"],
  ])("%s is not a steer (%s)", (text: string) => {
    expect(carriesSteerMarker(text)).toBe(false);
  });
});

describe("human turns are separated from the harness's own entries", () => {
  test("a genuine string-content user turn is a human turn", () => {
    expect(humanTurnsIn(userEntry("hello"))).toEqual(["hello"]);
  });

  test("a tool_result user entry is not a human turn", () => {
    expect(
      humanTurnsIn(userEntry([{ type: "tool_result", content: "output" }])),
    ).toEqual([]);
  });

  test("an isMeta user entry is not a human turn", () => {
    expect(humanTurnsIn(userEntry("injected", { isMeta: true }))).toEqual([]);
  });

  test("an assistant turn is not a human turn", () => {
    expect(humanTurnsIn(assistantEntry("URGENT — my own text"))).toEqual([]);
  });

  test("this hook's own advisory is not read back as a fresh steer", () => {
    const ownOutput = acknowledgementDirective({ steer: "URGENT — stop" });

    expect(humanTurnsIn(userEntry(ownOutput))).toEqual([]);
  });

  test("unparseable and blank lines are skipped without losing later turns", () => {
    expect(
      humanTurnsIn(transcriptOf("not json", "", userEntry("real turn"))),
    ).toEqual(["real turn"]);
  });
});

describe("pending steer detection", () => {
  test("a transcript with no marked turn yields none", () => {
    expect(
      pendingSteerIn({
        transcript: transcriptOf(userEntry("ordinary"), assistantEntry("work")),
      }),
    ).toEqual({ state: "none" });
  });

  test("a marked turn yields that steer", () => {
    expect(
      pendingSteerIn({
        transcript: transcriptOf(
          userEntry("ordinary"),
          userEntry("URGENT — stop rebasing"),
        ),
      }),
    ).toEqual({ state: "pending", steer: "URGENT — stop rebasing" });
  });

  test("the latest steer supersedes an earlier unacknowledged one", () => {
    expect(
      pendingSteerIn({
        transcript: transcriptOf(
          userEntry("URGENT — first target"),
          assistantEntry("working"),
          userEntry("STEER: second target"),
        ),
      }),
    ).toEqual({ state: "pending", steer: "STEER: second target" });
  });

  test("a steer arriving after tool results is still detected", () => {
    expect(
      pendingSteerIn({
        transcript: transcriptOf(
          userEntry("URGENT — the real steer"),
          userEntry([{ type: "tool_result", content: "seat output" }]),
        ),
      }),
    ).toEqual({ state: "pending", steer: "URGENT — the real steer" });
  });
});

describe("the acknowledgement directive", () => {
  test("it opens with the marker the hook excludes itself by", () => {
    expect(
      acknowledgementDirective({ steer: "URGENT — stop" }).startsWith(
        ACKNOWLEDGEMENT_OPENING,
      ),
    ).toBe(true);
  });

  test("it quotes the operator's own words", () => {
    expect(acknowledgementDirective({ steer: "STEER: use lane B" })).toContain(
      "STEER: use lane B",
    );
  });

  test("it asks for acknowledgement and resumption, never for a stop", () => {
    const directive = acknowledgementDirective({ steer: "URGENT — check" });

    expect(directive).toContain("then resume");
    expect(directive).toContain("never noise");
  });
});

describe("the surfaced ledger suppresses a repeat of the same steer", () => {
  // The ledger is a port, so these exercise the detection against a fake and
  // touch no filesystem — the property the module header claims.
  const fakeLedger = (): SteerLedger & { readonly written: string[] } => {
    const written: string[] = [];
    return {
      written,
      readFingerprints: (): readonly string[] => written,
      appendFingerprint: (fingerprint: string): void => {
        written.push(fingerprint);
      },
    };
  };

  test("an unseen steer has not been surfaced", () => {
    expect(
      alreadySurfaced({ ledger: fakeLedger(), steer: "URGENT — new" }),
    ).toBe(false);
  });

  test("a recorded steer reads as already surfaced", () => {
    const ledger = fakeLedger();
    recordSurfaced({ ledger, steer: "URGENT — seen" });

    expect(alreadySurfaced({ ledger, steer: "URGENT — seen" })).toBe(true);
  });

  test("a different steer is still surfaced after an earlier one", () => {
    const ledger = fakeLedger();
    recordSurfaced({ ledger, steer: "URGENT — first" });

    expect(alreadySurfaced({ ledger, steer: "STEER: second" })).toBe(false);
  });

  test("what is written is the fingerprint, never the operator's words", () => {
    const ledger = fakeLedger();
    recordSurfaced({ ledger, steer: "URGENT — sensitive prose" });

    expect(ledger.written).toEqual([fingerprintOf("URGENT — sensitive prose")]);
    expect(ledger.written.join("")).not.toContain("sensitive");
  });

  test("whitespace-only differences are the same steer", () => {
    expect(fingerprintOf("URGENT — same  ")).toBe(
      fingerprintOf("URGENT — same"),
    );
  });
});
