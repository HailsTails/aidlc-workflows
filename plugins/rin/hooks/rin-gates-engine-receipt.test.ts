import { describe, expect, test } from "vitest";
import {
  type EngineInvocation,
  type ReviewSectionAppend,
  recordEngineReceipt,
  reviewSectionFor,
} from "./rin-gates-engine-receipt";

type Call = {
  readonly stage: string;
  readonly reviewer: string;
  readonly iteration: number;
  readonly verdict: string | null;
};

const recordingEngine = (
  respond: (call: Call) => { readonly ok: boolean; readonly output: string },
): { readonly invoke: EngineInvocation; readonly calls: Call[] } => {
  const calls: Call[] = [];
  const invoke: EngineInvocation = (args) => {
    const call = {
      stage: args.stage,
      reviewer: args.reviewer,
      iteration: args.iteration,
      verdict: args.verdict,
    };
    calls.push(call);
    return respond(call);
  };
  return { invoke, calls };
};

const accepting = () => ({ ok: true, output: "" });

type AppendedSection = { readonly stage: string; readonly section: string };

const recordingAppend = (
  ok = true,
): {
  readonly append: ReviewSectionAppend;
  readonly appended: AppendedSection[];
} => {
  const appended: AppendedSection[] = [];
  const append: ReviewSectionAppend = (args) => {
    appended.push({ stage: args.stage, section: args.section });
    return ok
      ? { ok: true, detail: "/checkout/probe.md" }
      : { ok: false, detail: "artifact unwritable" };
  };
  return { append, appended };
};

describe("recordEngineReceipt", () => {
  test.each([
    true,
    false,
  ])("validates final-pass completion through the engine when its request budget is exhausted: %s", (completionAccepted) => {
    const engine = recordingEngine((call) =>
      call.verdict === null
        ? {
            ok: false,
            output: JSON.stringify({
              error:
                'Cannot request review pass 3 for "rin-gate-1-framing" because this stage allows 2 review passes.',
            }),
          }
        : {
            ok: completionAccepted,
            output: completionAccepted ? "" : "No matching pending request",
          },
    );
    const outcome = recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-1-framing",
      declaredReviewer: "aidlc-architecture-reviewer-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend().append,
    });
    expect(engine.calls[1]).toMatchObject({ iteration: 2, verdict: "READY" });
    expect(outcome).toMatchObject(
      completionAccepted
        ? { kind: "recorded", iteration: 2 }
        : { kind: "refused", step: "completed" },
    );
  });

  test.each([
    'Cannot request review pass 3 for "another-stage" because this stage allows 2 review passes.',
    'Cannot request review pass 4 for "rin-gate-1-framing" because this stage allows 2 review passes.',
  ])("refuses unrelated or inconsistent review limits: %s", (output) => {
    const engine = recordingEngine(() => ({ ok: false, output }));
    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-1-framing",
        declaredReviewer: "aidlc-architecture-reviewer-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toMatchObject({ kind: "refused", step: "requested" });
    expect(engine.calls).toHaveLength(1);
  });

  test("records the request/verdict pair for the gate's declared reviewer", () => {
    const engine = recordingEngine(accepting);
    const outcome = recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-0-reconcile",
      declaredReviewer: "aidlc-architecture-reviewer-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend().append,
    });

    expect(outcome).toEqual({
      kind: "recorded",
      reviewer: "aidlc-architecture-reviewer-agent",
      iteration: 1,
    });
    expect(engine.calls).toEqual([
      {
        stage: "rin-gate-0-reconcile",
        reviewer: "aidlc-architecture-reviewer-agent",
        iteration: 1,
        verdict: null,
      },
      {
        stage: "rin-gate-0-reconcile",
        reviewer: "aidlc-architecture-reviewer-agent",
        iteration: 1,
        verdict: "READY",
      },
    ]);
  });

  test("mirrors a NOT-READY aggregate into the receipt rather than reporting READY", () => {
    const engine = recordingEngine(accepting);
    recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-2-plan-review",
      declaredReviewer: "aidlc-architecture-reviewer-agent",
      aggregate: "NOT-READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend().append,
    });

    expect(engine.calls[1].verdict).toBe("NOT-READY");
  });

  test("advances to the ordinal the engine names when a prior receipt exists", () => {
    const engine = recordingEngine((call) =>
      call.iteration === 1 && call.verdict === null
        ? {
            ok: false,
            output:
              'Refusing REVIEW_REQUESTED for "rin-gate-4-implement": iteration 1 is out of sequence; expected 3 from the current audit attempt.',
          }
        : accepting(),
    );

    const outcome = recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-4-implement",
      declaredReviewer: "rin-decorrelated-review-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend().append,
    });

    expect(outcome).toEqual({
      kind: "recorded",
      reviewer: "rin-decorrelated-review-agent",
      iteration: 3,
    });
    expect(engine.calls.map((call) => call.iteration)).toEqual([1, 3, 3]);
  });

  test("advances to the ordinal named by the modern engine response", () => {
    const engine = recordingEngine((call) =>
      call.iteration === 1 && call.verdict === null
        ? {
            ok: false,
            output:
              'Cannot start review iteration 1 for "rin-gate-4-implement" because the next iteration is 3. Retry with --iteration 3.',
          }
        : accepting(),
    );

    const outcome = recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-4-implement",
      declaredReviewer: "rin-decorrelated-review-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend().append,
    });

    expect(outcome).toEqual({
      kind: "recorded",
      reviewer: "rin-decorrelated-review-agent",
      iteration: 3,
    });
    expect(engine.calls.map((call) => call.iteration)).toEqual([1, 3, 3]);
  });

  test.each([
    'Cannot start another review for "rin-gate-1-framing" because iteration 1 is still waiting for a verdict. Record that verdict, or repeat the same iteration with --retry-pending if the reviewer did not run.',
    'Refusing REVIEW_REQUESTED for "rin-gate-1-framing": iteration 1 is still unmatched. Complete it, or repeat that exact ordinal with --retry-pending.',
  ])("completes the existing pending request: %s", (error) => {
    const engine = recordingEngine((call) =>
      call.verdict === null
        ? {
            ok: false,
            output: JSON.stringify({
              error,
            }),
          }
        : accepting(),
    );

    const outcome = recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-1-framing",
      declaredReviewer: "aidlc-architecture-reviewer-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend().append,
    });

    expect(outcome).toEqual({
      kind: "recorded",
      reviewer: "aidlc-architecture-reviewer-agent",
      iteration: 1,
    });
    expect(engine.calls.map((call) => call.verdict)).toEqual([null, "READY"]);
  });

  test("completes a pending request found after modern ordinal discovery", () => {
    const engine = recordingEngine((call) => {
      if (call.iteration === 1) {
        return {
          ok: false,
          output:
            'Cannot start review iteration 1 for "rin-gate-4-implement" because the next iteration is 3. Retry with --iteration 3.',
        };
      }
      return call.verdict === null
        ? {
            ok: false,
            output:
              'Cannot start another review for "rin-gate-4-implement" because iteration 3 is still waiting for a verdict. Record that verdict, or repeat the same iteration with --retry-pending if the reviewer did not run.',
          }
        : accepting();
    });

    const outcome = recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-4-implement",
      declaredReviewer: "rin-decorrelated-review-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend().append,
    });

    expect(outcome).toEqual({
      kind: "recorded",
      reviewer: "rin-decorrelated-review-agent",
      iteration: 3,
    });
    expect(engine.calls.map((call) => call.iteration)).toEqual([1, 3, 3]);
  });

  test("refuses a pending ordinal that disagrees with the requested iteration", () => {
    const engine = recordingEngine((call) =>
      call.iteration === 1
        ? {
            ok: false,
            output:
              'Cannot start review iteration 1 for "rin-gate-4-implement" because the next iteration is 3. Retry with --iteration 3.',
          }
        : {
            ok: false,
            output:
              'Cannot start another review for "rin-gate-4-implement" because iteration 2 is still waiting for a verdict. Record that verdict, or repeat the same iteration with --retry-pending if the reviewer did not run.',
          },
    );

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-4-implement",
        declaredReviewer: "rin-decorrelated-review-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "refused",
        step: "requested",
      }),
    );
    expect(engine.calls).toHaveLength(2);
  });

  test("refuses a pending response for a different stage", () => {
    const engine = recordingEngine(() => ({
      ok: false,
      output:
        'Cannot start another review for "rin-gate-2-plan-review" because iteration 1 is still waiting for a verdict.',
    }));

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-1-framing",
        declaredReviewer: "aidlc-architecture-reviewer-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "refused",
        step: "requested",
      }),
    );
    expect(engine.calls).toHaveLength(1);
  });

  test("refuses malformed modern ordinal guidance", () => {
    const engine = recordingEngine(() => ({
      ok: false,
      output:
        'Cannot start review iteration 1 for "rin-gate-4-implement" because the next iteration is 3. Retry with --iteration 4.',
    }));

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-4-implement",
        declaredReviewer: "rin-decorrelated-review-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "refused",
        step: "requested",
      }),
    );
    expect(engine.calls).toHaveLength(1);
  });

  test("reports the engine's refusal instead of claiming a receipt it did not get", () => {
    const engine = recordingEngine((call) =>
      call.verdict === null
        ? accepting()
        : {
            ok: false,
            output: "declared artifacts changed after REVIEW_REQUESTED",
          },
    );

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-6-operate",
        declaredReviewer: "rin-decorrelated-review-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual({
      kind: "refused",
      step: "completed",
      reason: "other",
      detail: "declared artifacts changed after REVIEW_REQUESTED",
    });
  });

  // The engine's SECOND refusal shape carries no ordinal, so the ordinal recovery
  // cannot reach it and no further receipt is possible in this review attempt.
  // Naming it is what lets the caller warn that the engine's reviewer floor is
  // left resting on an older receipt.
  test("names the recovery-spent refusal rather than reporting an undifferentiated failure", () => {
    const engine = recordingEngine(() => ({
      ok: false,
      output:
        'Refusing REVIEW_REQUESTED for "rin-gate-4-implement": the one stale-receipt recovery ' +
        "request already exists in this review attempt. If its dispatch is still unmatched, " +
        "retry iteration 2 with --retry-pending; if its verdict was recorded, that recovery " +
        "receipt is terminal and no further review request is allowed.",
    }));

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-4-implement",
        declaredReviewer: "rin-decorrelated-review-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "refused",
        step: "requested",
        reason: "recovery-spent",
      }),
    );
  });

  test("names the recovery-spent refusal raised after the pass was already exhausted", () => {
    const engine = recordingEngine(() => ({
      ok: false,
      output:
        'Refusing REVIEW_REQUESTED for "rin-gate-4-implement": the one stale-receipt recovery ' +
        "review pass was already spent, and its receipt was invalidated again by another later " +
        "write to a declared produces[] artifact.",
    }));

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-4-implement",
        declaredReviewer: "rin-decorrelated-review-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "refused",
        step: "requested",
        reason: "recovery-spent",
      }),
    );
  });

  test("names an out-of-sequence refusal the ordinal recovery could not clear", () => {
    const outOfSequence = {
      ok: false,
      output:
        'Refusing REVIEW_REQUESTED for "rin-gate-4-implement": iteration 1 is out of sequence; ' +
        "expected 3 from the current audit attempt.",
    };
    const engine = recordingEngine(() => outOfSequence);

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-4-implement",
        declaredReviewer: "rin-decorrelated-review-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "refused",
        step: "requested",
        reason: "out-of-sequence-unrecovered",
      }),
    );
  });

  test("reports an unparseable request refusal rather than retrying blindly", () => {
    const engine = recordingEngine(() => ({
      ok: false,
      output: "engine unavailable",
    }));

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-0-reconcile",
        declaredReviewer: "aidlc-architecture-reviewer-agent",
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual({
      kind: "refused",
      step: "requested",
      reason: "other",
      detail: "engine unavailable",
    });
    expect(engine.calls).toHaveLength(1);
  });

  test("attempts nothing for a gate that declares no reviewer", () => {
    const engine = recordingEngine(accepting);

    expect(
      recordEngineReceipt({
        projectDir: "/checkout",
        gate: "rin-gate-9-unreviewed",
        declaredReviewer: null,
        aggregate: "READY",
        invokeEngine: engine.invoke,
        appendReviewSection: recordingAppend().append,
      }),
    ).toEqual({ kind: "no-declared-reviewer" });
    expect(engine.calls).toEqual([]);
  });

  test("appends the review section between the request and the completion", () => {
    const engine = recordingEngine(accepting);
    const appendPort = recordingAppend();

    recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-0-reconcile",
      declaredReviewer: "aidlc-architecture-reviewer-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: appendPort.append,
    });

    expect(appendPort.appended).toHaveLength(1);
    expect(appendPort.appended[0].stage).toBe("rin-gate-0-reconcile");
    expect(engine.calls.map((call) => call.verdict)).toEqual([null, "READY"]);
  });

  test("refuses the receipt when the section cannot be appended", () => {
    const engine = recordingEngine(accepting);

    const outcome = recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-0-reconcile",
      declaredReviewer: "aidlc-architecture-reviewer-agent",
      aggregate: "READY",
      invokeEngine: engine.invoke,
      appendReviewSection: recordingAppend(false).append,
    });

    expect(outcome).toEqual({
      kind: "refused",
      step: "completed",
      reason: "other",
      detail: "artifact unwritable",
    });
    expect(engine.calls.map((call) => call.verdict)).toEqual([null]);
  });

  test("mirrors a NOT-READY aggregate into the appended section", () => {
    const engine = recordingEngine(accepting);
    const appendPort = recordingAppend();

    recordEngineReceipt({
      projectDir: "/checkout",
      gate: "rin-gate-0-reconcile",
      declaredReviewer: "aidlc-architecture-reviewer-agent",
      aggregate: "NOT-READY",
      invokeEngine: engine.invoke,
      appendReviewSection: appendPort.append,
    });

    expect(appendPort.appended[0].section).toContain("**Verdict:** NOT-READY");
  });
});

describe("reviewSectionFor", () => {
  const section = reviewSectionFor({
    verdict: "READY",
    reviewer: "aidlc-architecture-reviewer-agent",
    iteration: 2,
  });

  test("opens with the exact `## Review` heading the engine anchors on", () => {
    expect(section.startsWith("## Review\n")).toBe(true);
  });

  test("carries exactly one of each canonical authority line", () => {
    expect(section.match(/\*\*Verdict:\*\*/g)).toHaveLength(1);
    expect(section.match(/\*\*Reviewer:\*\*/g)).toHaveLength(1);
    expect(section.match(/\*\*Iteration:\*\*/g)).toHaveLength(1);
  });

  // The trap this section exists to avoid: the engine renders `table: () => ""`
  // and `list: () => ""` when extracting authority, so a verdict written inside
  // either renders to nothing and the completion is refused for carrying no
  // canonical verdict line. Each authority line must be its own paragraph.
  test("writes every authority line as a paragraph, never a table or list row", () => {
    const authorityLines = section
      .split("\n")
      .filter((line) => line.startsWith("**"));

    expect(authorityLines).toHaveLength(3);
    expect(authorityLines.filter((line) => line.startsWith("|"))).toEqual([]);
    expect(authorityLines.filter((line) => line.startsWith("-"))).toEqual([]);
  });
});
