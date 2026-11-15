import { describe, expect, it } from "vitest";
import { createdNumberOf } from "./created-write.ts";
import { fail, succeed } from "./result.ts";

describe("createdNumberOf", () => {
  it.each([
    ["https://github.com/HailsTails/minutesarah-shop/pull/12\n", 12],
    ["https://github.com/HailsTails/minutesarah-shop/issues/429\n", 429],
    ["Creating pull request\nhttps://github.com/HailsTails/minutesarah-shop/pull/7", 7],
  ])("reads the number gh printed in %j", (standardOutput, createdNumber) => {
    expect(createdNumberOf(standardOutput)).toEqual(succeed(createdNumber));
  });

  it.each([
    "",
    "https://github.com/HailsTails/minutesarah-shop\n",
    "https://github.com/HailsTails/minutesarah-shop/pull/12/files\n",
    "https://github.com/HailsTails/minutesarah-shop/pull/0\n",
  ])("finds no created number in %j", (standardOutput) => {
    expect(createdNumberOf(standardOutput)).toEqual(fail({ kind: "created-number-unreadable" }));
  });
});
