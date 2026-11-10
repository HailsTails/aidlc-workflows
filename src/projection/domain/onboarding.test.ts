import { expect, test } from "bun:test";
import { declaredSlots, renderNeutralOnboarding, renderOnboarding } from "./onboarding.ts";

test("slots are discovered once in authored order", () => {
  expect(declaredSlots("{{SLOT:first}} {{SLOT:second}} {{SLOT:first}}"))
    .toEqual(["first", "second"]);
});

test("native slots bind the entry while runtime tokens survive for their one pass", () => {
  expect(renderOnboarding("{{SLOT:title_block}}\n\nUse {{SKILL_INVOKE}} in {{HARNESS_DIR}} with {{INVOKE}}.\n", {
    invoke: "/aidlc", slots: { ["title_block"]: "# Host" },
  })).toEqual({ ok: true, value: "# Host\n\nUse /aidlc in {{HARNESS_DIR}} with {{INVOKE}}.\n" });
});

test("omitted standalone and inline slots preserve exact blank-line normalization", () => {
  expect(renderOnboarding("# Host\n\n{{SLOT:optional}}\n\nRead {{SLOT:inline}} \n\n\n", {
    invoke: "/aidlc", slots: {},
  })).toEqual({ ok: true, value: "# Host\n\nRead\n" });
});

test("an unfilled marker introduced by a fill returns the retained failure text", () => {
  expect(renderOnboarding("{{SLOT:title_block}}", {
    invoke: "/aidlc", slots: { ["title_block"]: "{{SLOT:unfinished}}" },
  })).toEqual({ ok: false, refusal:
    'onboarding render incomplete: marker {{SLOT:unfinished}} survived for invoke="/aidlc". ' +
    "Every {{SLOT:...}} the skeleton declares must be fillable.",
  });
});

test("neutral onboarding rejects markers without throwing", () => {
  expect(renderNeutralOnboarding("Read {{HARNESS_DIR}}"))
    .toEqual({ ok: false, refusal: "neutral onboarding must not contain template markers" });
});

test("neutral onboarding preserves its marker-free text and terminal newline", () => {
  expect(renderNeutralOnboarding("# Shared\n\n\nWork  \n"))
    .toEqual({ ok: true, value: "# Shared\n\nWork\n" });
});
