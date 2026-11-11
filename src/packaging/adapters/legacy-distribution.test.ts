import { expect, test } from "bun:test";
import { copyStartsWithout, harnessChoiceTextIsPlain, sha256Bytes, writtenRootIntegration }
  from "./legacy-distribution.ts";

test("distribution compatibility keeps old-reader policy encoding and exact content hashes", () => {
  expect(writtenRootIntegration({ path: "settings.json", policy: "json-entries" })).toEqual({
    path: "settings.json", policy: "whole-file", extendedPolicy: "json-entries",
  });
  expect(sha256Bytes("abc")).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(copyStartsWithout({ policy: "json-map", optional: true })).toBe(true);
  expect(copyStartsWithout({ policy: "managed-block" })).toBe(false);
  expect(harnessChoiceTextIsPlain({ choiceName: "Editor", choiceNote: "Command line" })).toBe(true);
  expect(harnessChoiceTextIsPlain({ choiceName: "Editor\nInjected line" })).toBe(false);
});
