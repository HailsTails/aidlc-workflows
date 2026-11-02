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
    ["Matcher", "matcher"],
  ])("reads %j and %j as one stem", (left, right) => {
    expect([...stemsOf({ text: left }).keys()]).toEqual([...stemsOf({ text: right }).keys()]);
  });

  it.each([
    ["class"],
    ["process"],
    ["focus"],
    ["status"],
    ["analysis"],
  ])("keeps the final s of %j", (word) => {
    expect([...stemsOf({ text: word }).keys()][0]?.endsWith("s")).toBe(true);
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
