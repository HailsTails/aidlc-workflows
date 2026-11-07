import { describe, expect, it } from "vitest";
import { stemsOf, stemsShared, stemsWithout, wordsOf } from "./chain-stems.ts";

describe("stemsOf reads the content words of a sentence", () => {
  it("drops function words, words under three letters and bare numbers", () => {
    expect(wordsOf({ stems: stemsOf({ text: "Why is the matcher at 42 so old, if CI is red?" }) })).toEqual([
      "matcher",
      "old",
      "red",
    ]);
  });

  it("splits camelCase identifiers and paths into their words", () => {
    expect(wordsOf({ stems: stemsOf({ text: "readBuiltTargets in tools/audit/name-matcher.ts" }) })).toEqual([
      "read",
      "built",
      "targets",
      "tools",
      "audit",
      "name",
      "matcher",
    ]);
  });

  it("keeps the first spelling of each stem", () => {
    expect(wordsOf({ stems: stemsOf({ text: "Matchers match the matcher" }) })).toEqual(["matchers", "match"]);
  });

  it("drops pronouns, possessives and prepositions", () => {
    expect(wordsOf({ stems: stemsOf({ text: "Since then our approach, about your view, held until now via you" }) })).toEqual([
      "approach",
      "view",
      "held",
    ]);
  });

  it.each([
    "outside", "inside", "across", "along", "behind", "despite", "except", "including", "instead", "anyway",
    "somebody", "everybody", "throughout", "whereas",
  ])("drops the function word %j", (word) => {
    expect(stemsOf({ text: word }).size).toBe(0);
  });

  it("reads a negative contraction as its function words", () => {
    expect(
      wordsOf({ stems: stemsOf({ text: "The parser doesn't export, isn't scheduled, didn't ship, wasn't asked, can't wait, won’t move" }) }),
    ).toEqual(["parser", "export", "scheduled", "ship", "asked", "wait", "move"]);
  });

  it("reads no words from a sentence of function words", () => {
    expect(stemsOf({ text: "why is that so?" }).size).toBe(0);
  });
});

describe("stemsOf reads inflections of one word as one stem", () => {
  it.each([
    ["predates", "predate"],
    ["shared", "share"],
    ["shares", "share"],
    ["matchers", "matcher"],
    ["matches", "match"],
    ["copies", "copy"],
    ["copied", "copy"],
    ["classes", "class"],
    ["processes", "process"],
    ["boxes", "box"],
    ["loading", "load"],
    ["focuses", "focus"],
    ["statuses", "status"],
    ["lowercases", "lowercase"],
    ["bases", "base"],
    ["findings", "finding"],
    ["strings", "string"],
    ["settings", "setting"],
    ["warnings", "warning"],
    ["embeds", "embed"],
    ["committed", "commit"],
    ["flagged", "flag"],
    ["skipped", "skip"],
    ["running", "run"],
    ["mapped", "map"],
    ["logged", "log"],
    ["pinned", "pin"],
    ["used", "use"],
    ["using", "use"],
    ["added", "add"],
    ["falling", "fall"],
    ["passing", "pass"],
    ["needed", "need"],
    ["exceeded", "exceed"],
    ["speeding", "speed"],
    ["bringing", "bring"],
    ["Matcher", "matcher"],
  ])("reads %j and %j as one stem", (left, right) => {
    expect(stemsOf({ text: `${left} ${right}` }).size).toBe(1);
  });

  it.each([
    ["class"],
    ["process"],
    ["focus"],
    ["status"],
    ["analysis"],
  ])("keeps the final s of %j", (word) => {
    expect(stemsOf({ text: word })).toEqual(new Map([[word, word]]));
  });
});

describe("stemsShared and stemsWithout compare two stem sets", () => {
  const left = stemsOf({ text: "the matcher predates the tracker format" });
  const right = stemsOf({ text: "why does the matcher predate the format" });

  it("keeps the stems both sets hold, spelled as the left set spells them", () => {
    expect(wordsOf({ stems: stemsShared({ left, right }) })).toEqual(["matcher", "predates", "format"]);
  });

  it("removes the excluded stems", () => {
    expect(wordsOf({ stems: stemsWithout({ stems: left, excluded: [right] }) })).toEqual(["tracker"]);
  });

  it("removes the stems of every excluded set", () => {
    expect(
      stemsWithout({ stems: left, excluded: [right, stemsOf({ text: "tracker" })] }).size,
    ).toBe(0);
  });
});
