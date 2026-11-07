// covers: function:compareComposerPlans, function:composerPlansShown

import { describe, expect, mock, test } from "bun:test";
import { composerPlansShown, compareComposerPlans } from "./aidlc-composer-plan-selection.ts";

const offered = {
  scope: "express",
  changes: { skip: ["domain-design", "functional-design"], add: ["ci-pipeline", "incident-response"] },
  projectType: "brownfield",
  depth: "minimal",
  settings: { sensors: "on", review: "adversarial" },
  guardPolicy: "strict",
  at: "2026-11-06T01:00:00Z",
};

describe("composer plan identity", () => {
  test("keeping the same offer again does not create a new identity", () => {
    const repeated = {
      ...offered,
      changes: { skip: ["functional-design", "domain-design"], add: ["incident-response", "ci-pipeline"] },
      settings: { review: "adversarial", sensors: "on" },
      at: "2026-11-06T02:00:00Z",
    };
    expect(compareComposerPlans({ left: offered, right: repeated })).toBe("same-plan");
  });

  test.each([
    ["base scope", { ...offered, scope: "classic" }],
    ["skipped stages", { ...offered, changes: { ...offered.changes, skip: ["domain-design"] } }],
    ["added stages", { ...offered, changes: { ...offered.changes, add: ["ci-pipeline"] } }],
    ["project classification", { ...offered, projectType: "greenfield" }],
    ["depth", { ...offered, depth: "standard" }],
    ["settings", { ...offered, settings: { sensors: "off", review: "adversarial" } }],
    ["Guard Policy", { ...offered, guardPolicy: "relaxed" }],
  ] as const)("a changed %s is a different offer", (_field, changed) => {
    expect(compareComposerPlans({ left: offered, right: changed })).toBe("different-plan");
  });

  test("missing and empty settings describe the same default settings", () => {
    expect(compareComposerPlans({ left: { scope: "express", changes: { skip: [], add: [] } }, right: { scope: "express", changes: { skip: [], add: [] }, settings: {} } }
    )).toBe("same-plan");
  });

  test("comparing readonly stage lists preserves their authored order", () => {
    const original = {
      scope: "express",
      changes: {
        skip: Object.freeze(["functional-design", "domain-design"]),
        add: Object.freeze(["incident-response", "ci-pipeline"]),
      },
    };
    expect(compareComposerPlans({ left: original, right: {
      scope: "express",
      changes: { skip: ["domain-design", "functional-design"], add: ["ci-pipeline", "incident-response"] },
    } })).toBe("same-plan");
    expect(original.changes.skip).toEqual(["functional-design", "domain-design"]);
    expect(original.changes.add).toEqual(["incident-response", "ci-pipeline"]);
  });
});

type RecordedOffer = { scope: string; at?: string };
const initial: RecordedOffer = { scope: "express", at: "before-reply" };
const rebuilt: RecordedOffer = { scope: "classic", at: "after-reply" };
const rebuiltAgain: RecordedOffer = { scope: "feature", at: "later-still" };
type ReplyObserver = (request: { at: string }) => "reply-observed" | "reply-not-observed";
const noReplyObserved = (): "reply-not-observed" => "reply-not-observed";
const replyAfterNewest = (): "reply-observed" => "reply-observed";

describe("the offer shown before a reply", () => {
  test("a fresh reconstruction leaves the earlier offer shown", () => {
    const observeReply = mock<ReplyObserver>().mockReturnValueOnce("reply-not-observed").mockReturnValueOnce("reply-observed");
    const selection = composerPlansShown({ plan: rebuilt, earlier: [initial], observeReply });
    expect(selection.shown).toBe(initial);
    expect(selection.unseen).toBe(rebuilt);
  });

  test("several later reconstructions cannot replace the shown offer", () => {
    const observeReply = mock<ReplyObserver>()
      .mockReturnValueOnce("reply-not-observed").mockReturnValueOnce("reply-not-observed").mockReturnValueOnce("reply-observed");
    const selection = composerPlansShown({ plan: rebuiltAgain, earlier: [initial, rebuilt], observeReply });
    expect(selection.shown).toBe(initial);
    expect(selection.unseen).toBe(rebuiltAgain);
  });

  test("with no observed reply, none of the dated offers is shown", () => {
    expect(composerPlansShown({ plan: rebuilt, earlier: [initial], observeReply: noReplyObserved })).toEqual({ shown: null, unseen: rebuilt });
  });

  test("a reply after the newest offer leaves no unseen replacement", () => {
    const selection = composerPlansShown({ plan: rebuilt, earlier: [initial], observeReply: replyAfterNewest });
    expect(selection.shown).toBe(rebuilt);
    expect(selection.unseen).toBeNull();
  });

  test("the most recent observed offer wins without consulting earlier provenance", () => {
    const observeReply = mock<ReplyObserver>().mockReturnValueOnce("reply-not-observed").mockReturnValueOnce("reply-observed");
    const selection = composerPlansShown({ plan: rebuiltAgain, earlier: [initial, rebuilt], observeReply });
    expect(selection.shown).toBe(rebuilt);
    expect(selection.unseen).toBe(rebuiltAgain);
    expect(observeReply).toHaveBeenNthCalledWith(1, { at: "later-still" });
    expect(observeReply).toHaveBeenNthCalledWith(2, { at: "after-reply" });
    expect(observeReply).toHaveBeenCalledTimes(2);
  });

  test("an older untimed offer remains shown when its replacement is unseen", () => {
    const legacy: RecordedOffer = { scope: "express" };
    const selection = composerPlansShown({ plan: rebuilt, earlier: [legacy], observeReply: noReplyObserved });
    expect(selection.shown).toBe(legacy);
    expect(selection.unseen).toBe(rebuilt);
  });

  test("an untimed newest offer keeps the legacy seen behavior", () => {
    const legacy: RecordedOffer = { scope: "express" };
    const selection = composerPlansShown({ plan: legacy, earlier: [initial], observeReply: noReplyObserved });
    expect(selection.shown).toBe(legacy);
    expect(selection.unseen).toBeNull();
  });

  test("selection does not reorder frozen history", () => {
    const history = Object.freeze([initial, rebuilt]);
    composerPlansShown({ plan: rebuiltAgain, earlier: history, observeReply: noReplyObserved });
    expect(history).toEqual([initial, rebuilt]);
  });
});
